import { ethers } from 'ethers';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

// Chain metadata config
const CHAIN_INFO: Record<number, { name: string; type: string; symbol: string; explorer: string }> = {
    1: { name: 'Ethereum', type: 'evm', symbol: 'ETH', explorer: 'https://etherscan.io' },
    56: { name: 'BNB Smart Chain', type: 'evm', symbol: 'BNB', explorer: 'https://bscscan.com' },
    137: { name: 'Polygon', type: 'evm', symbol: 'POL', explorer: 'https://polygonscan.com' },
    42161: { name: 'Arbitrum One', type: 'evm', symbol: 'ETH', explorer: 'https://arbiscan.io' },
    10: { name: 'Optimism', type: 'evm', symbol: 'ETH', explorer: 'https://optimistic.etherscan.io' },
    8453: { name: 'Base', type: 'evm', symbol: 'ETH', explorer: 'https://basescan.org' },
    // Non-EVM stored with negative IDs to avoid collision
    900000001: { name: 'Solana', type: 'solana', symbol: 'SOL', explorer: 'https://solscan.io' },
    900000002: { name: 'TRON', type: 'tron', symbol: 'TRX', explorer: 'https://tronscan.org' },
    900000003: { name: 'TON', type: 'ton', symbol: 'TON', explorer: 'https://tonscan.org' },
    900000004: { name: 'Aptos', type: 'aptos', symbol: 'APT', explorer: 'https://explorer.aptoslabs.com' },
};

/** Validate address format by chain type */
function validateAddress(address: string, chainType: string): boolean {
    switch (chainType) {
        case 'evm': return /^0x[0-9a-fA-F]{40}$/.test(address);
        case 'solana': return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        case 'tron': return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
        case 'ton': return /^[UE][Qq][0-9A-Za-z\-_]{46,48}$/.test(address) || /^[0-9a-fA-F]{64}$/.test(address);
        case 'aptos': return /^0x[0-9a-fA-F]{64}$/.test(address);
        default: return address.length > 10;
    }
}

export class WalletsService {
    async getUserWallets(userId: number) {
        const res = await query(
            `SELECT w.*, 
              COALESCE($1::jsonb->w.chain_id::text, '{}'::jsonb) AS chain_info
       FROM user_wallets w
       WHERE w.user_id = $2
       ORDER BY w.is_primary DESC, w.created_at ASC`,
            [JSON.stringify(CHAIN_INFO), userId]
        );
        // Enrich with chain info
        return res.rows.map(row => ({
            ...row,
            chain_info: CHAIN_INFO[row.chain_id] || { name: row.chain_type, type: row.chain_type },
        }));
    }

    async addWallet(userId: number, data: {
        chain_type: string; chain_id?: number; address: string; label?: string;
        is_primary?: boolean; message?: string; signature?: string;
    }) {
        const { chain_type, chain_id, address, label, is_primary, message, signature } = data;

        const allowedTypes = ['evm', 'solana', 'tron', 'ton', 'aptos', 'near', 'cosmos', 'bitcoin'];
        if (!allowedTypes.includes(chain_type)) throw new AppError(`Invalid chain_type: ${chain_type}`, 400);

        if (!validateAddress(address, chain_type)) {
            throw new AppError(`Invalid ${chain_type} address format`, 400);
        }

        // ── Ownership proof ──────────────────────────────────────────────
        // EVM wallets require a signed message: previously the frontend
        // signed a message client-side but the proof was never sent to the
        // backend, so a malicious caller could "claim" any wallet (and
        // worse, set it as their seller payout target after re-linking).
        // Non-EVM chains (Solana/Tron/...) don't have a uniform server-
        // verifiable signature library here yet, so we accept them as
        // unverified — but `is_verified` will reflect that, and downstream
        // checks (e.g. seller payout-wallet) require `is_verified = true`.
        let isVerified = false;
        if (chain_type === 'evm') {
            if (!message || !signature) {
                throw new AppError(
                    'message and signature are required to prove ownership of an EVM wallet',
                    400
                );
            }
            let recovered: string;
            try {
                recovered = ethers.verifyMessage(message, signature);
            } catch {
                throw new AppError('Invalid signature', 401);
            }
            if (recovered.toLowerCase() !== address.toLowerCase()) {
                throw new AppError('Signature does not match wallet address', 401);
            }
            // Anti-replay: the message must contain a timestamp within 5 minutes.
            // Accept either ISO 8601 ("2026-01-01T00:00:00Z") or unix ms.
            const tsMatch = message.match(/Timestamp:\s*(\S+)/i);
            if (!tsMatch) {
                throw new AppError('Signed message must include a "Timestamp:" line', 400);
            }
            const ts = /^\d+$/.test(tsMatch[1]) ? Number(tsMatch[1]) : Date.parse(tsMatch[1]);
            if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) {
                throw new AppError('Signed message timestamp expired or invalid (5 min window)', 401);
            }
            isVerified = true;
        }

        // If setting as primary, unset others
        if (is_primary) {
            await query(
                `UPDATE user_wallets SET is_primary = FALSE WHERE user_id = $1`,
                [userId]
            );
        }

        const res = await query(
            `INSERT INTO user_wallets (user_id, chain_type, chain_id, address, label, is_primary, is_verified, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id, chain_type, address) DO UPDATE
       SET label = EXCLUDED.label, is_primary = EXCLUDED.is_primary,
           is_verified = user_wallets.is_verified OR EXCLUDED.is_verified,
           verified_at = COALESCE(user_wallets.verified_at, EXCLUDED.verified_at),
           updated_at = NOW()
       RETURNING *`,
            [userId, chain_type, chain_id || null, address, label || null, is_primary ?? false, isVerified]
        );

        logger.info('Wallet added', { user_id: userId, chain_type, address, is_verified: isVerified });

        // ── Auto-heal seller payout wallet ──────────────────────────────
        // If this user has a seller_profile whose payout_wallet is still
        // NULL, set it to the wallet they just verified. Without this the
        // seller would have to do a second manual step before buyers can
        // pay them in crypto, and beginners forget. We only set when
        // payout_wallet IS NULL — never overwrite an explicit choice.
        if (chain_type === 'evm' && isVerified) {
            try {
                await query(
                    `UPDATE seller_profiles
                        SET payout_wallet = $1, updated_at = NOW()
                      WHERE user_id = $2 AND payout_wallet IS NULL`,
                    [address.toLowerCase(), userId]
                );
            } catch (err: any) {
                logger.warn('Auto-heal seller payout_wallet failed (non-fatal)', {
                    userId, address, err: err?.message,
                });
            }
        }

        return { ...res.rows[0], chain_info: CHAIN_INFO[chain_id!] };
    }

    async removeWallet(userId: number, walletDbId: number) {
        const existing = await query(
            'SELECT * FROM user_wallets WHERE wallet_db_id = $1 AND user_id = $2',
            [walletDbId, userId]
        );
        if (!existing.rows.length) throw new AppError('Wallet not found', 404);
        await query('DELETE FROM user_wallets WHERE wallet_db_id = $1', [walletDbId]);
    }

    async setPrimary(userId: number, walletDbId: number) {
        const existing = await query(
            'SELECT * FROM user_wallets WHERE wallet_db_id = $1 AND user_id = $2',
            [walletDbId, userId]
        );
        if (!existing.rows.length) throw new AppError('Wallet not found', 404);
        await query(`UPDATE user_wallets SET is_primary = FALSE WHERE user_id = $1`, [userId]);
        await query(`UPDATE user_wallets SET is_primary = TRUE, updated_at = NOW() WHERE wallet_db_id = $1`, [walletDbId]);
    }

    async getDepositHistory(userId: number, status?: string) {
        const where = status ? `AND wd.status = $2` : '';
        const params: any[] = [userId];
        if (status) params.push(status);

        const res = await query(
            `SELECT wd.*, tw.symbol, tw.decimals, tw.metadata->>'chain' AS chain_name
       FROM wallet_deposits wd
       JOIN token_whitelist tw ON wd.token_id = tw.token_id
       WHERE wd.user_id = $1 ${where}
       ORDER BY wd.created_at DESC
       LIMIT 50`,
            params
        );
        return res.rows;
    }

    async getDepositAddresses() {
        // Return platform deposit addresses per chain from platform_settings.
        // Legacy `platform_config` was consolidated into `platform_settings`
        // by migration 028; the `deposit_addresses` key was retired in
        // migration 023 (custodial deposit removed) so this typically
        // returns an empty object for non-custodial flows.
        const res = await query(
            `SELECT value FROM platform_settings WHERE key = 'deposit_addresses'`
        );
        const addresses = res.rows[0]?.value || {};

        // Enrich with chain info
        return Object.entries(CHAIN_INFO).map(([chainId, info]) => ({
            chain_id: parseInt(chainId),
            ...info,
            deposit_address: addresses[chainId] || null,
            // Token list for this chain
        }));
    }

    async getSupportedChains() {
        return Object.entries(CHAIN_INFO).map(([chainId, info]) => ({
            chain_id: parseInt(chainId),
            ...info,
        }));
    }

    async getChainTokens(chainId: number) {
        const res = await query(
            `SELECT * FROM token_whitelist WHERE chain_id = $1 AND is_active = TRUE ORDER BY symbol`,
            [chainId]
        );
        return res.rows;
    }

    /** Admin: record a confirmed deposit (called by deposit monitoring service) */
    async recordDeposit(userId: number, data: {
        token_id: number; chain_id: number; amount: number;
        tx_hash: string; from_address: string; to_address: string;
    }) {
        const { token_id, chain_id, amount, tx_hash, from_address, to_address } = data;
        const res = await query(
            `INSERT INTO wallet_deposits
         (user_id, token_id, chain_id, amount, tx_hash, from_address, to_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tx_hash, chain_id) DO NOTHING
       RETURNING *`,
            [userId, token_id, chain_id, amount, tx_hash, from_address, to_address]
        );
        return res.rows[0];
    }
}
