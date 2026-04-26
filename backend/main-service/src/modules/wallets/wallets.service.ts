import { query, getClient } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { verifySiweSignature } from '../../utils/siwe';

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
        const { chain_type, chain_id, label, is_primary, message, signature } = data;
        let { address } = data;

        const allowedTypes = ['evm', 'solana', 'tron', 'ton', 'aptos', 'near', 'cosmos', 'bitcoin'];
        if (!allowedTypes.includes(chain_type)) throw new AppError(`Invalid chain_type: ${chain_type}`, 400);

        if (!validateAddress(address, chain_type)) {
            throw new AppError(`Invalid ${chain_type} address format`, 400);
        }

        // EVM-only signature verification (SIWE).
        // Non-EVM chains can opt-in later by adding chain-specific verifiers.
        let verified = false;
        if (chain_type === 'evm') {
            if (!message || !signature) {
                throw new AppError('Signature & message are required to link an EVM wallet', 400);
            }
            await verifySiweSignature(address, message, signature);
            address = address.toLowerCase();
            verified = true;
        }

        // Cross-user uniqueness for EVM: same address must not belong to another user
        if (chain_type === 'evm') {
            const conflict = await query(
                `SELECT user_id FROM user_wallets
                 WHERE chain_type = 'evm' AND LOWER(address) = $1 AND user_id <> $2
                 LIMIT 1`,
                [address, userId]
            );
            if (conflict.rows.length > 0) {
                throw new AppError('This wallet is already linked to another account', 409);
            }
        }

        // Auto-promote first-ever wallet to primary
        const existingCount = await query(
            `SELECT COUNT(*)::int AS count FROM user_wallets WHERE user_id = $1`,
            [userId]
        );
        const isFirst = existingCount.rows[0].count === 0;
        const willBePrimary = is_primary ?? isFirst;

        const client = await getClient();
        try {
            await client.query('BEGIN');

            if (willBePrimary) {
                await client.query(
                    `UPDATE user_wallets SET is_primary = FALSE WHERE user_id = $1`,
                    [userId]
                );
            }

            // ON CONFLICT targets the partial unique indexes created in migration 020:
            //   - EVM: UNIQUE (LOWER(address)) WHERE chain_type = 'evm'
            //   - Non-EVM: UNIQUE (user_id, chain_type, address) WHERE chain_type <> 'evm'
            const res = await client.query(
                chain_type === 'evm'
                    ? `INSERT INTO user_wallets (user_id, chain_type, chain_id, address, label, is_primary, is_verified, verified_at)
                       VALUES ($1,$2,$3,$4,$5,$6, TRUE, NOW())
                       ON CONFLICT (LOWER(address)) WHERE chain_type = 'evm' DO UPDATE
                       SET label = COALESCE(EXCLUDED.label, user_wallets.label),
                           is_primary = (EXCLUDED.is_primary OR user_wallets.is_primary),
                           is_verified = TRUE,
                           verified_at = NOW(),
                           updated_at = NOW()
                       RETURNING *`
                    : `INSERT INTO user_wallets (user_id, chain_type, chain_id, address, label, is_primary, is_verified)
                       VALUES ($1,$2,$3,$4,$5,$6, FALSE)
                       ON CONFLICT (user_id, chain_type, address) WHERE chain_type <> 'evm' DO UPDATE
                       SET label = COALESCE(EXCLUDED.label, user_wallets.label),
                           is_primary = (EXCLUDED.is_primary OR user_wallets.is_primary),
                           updated_at = NOW()
                       RETURNING *`,
                [userId, chain_type, chain_id || null, address, label || null, willBePrimary]
            );

            // Sync to users.wallet_address when this is the user's primary EVM wallet
            if (chain_type === 'evm' && willBePrimary) {
                await client.query(
                    `UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE user_id = $2`,
                    [address, userId]
                );
            }

            await client.query('COMMIT');
            logger.info('Wallet added', { user_id: userId, chain_type, address, verified });
            const row = res.rows[0];
            return { ...row, chain_info: CHAIN_INFO[row.chain_id] || { name: chain_type, type: chain_type } };
        } catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw err;
        } finally {
            client.release();
        }
    }

    /** Update label of a wallet (does not change verification or primary state). */
    async updateLabel(userId: number, walletDbId: number, label: string | null) {
        const res = await query(
            `UPDATE user_wallets SET label = $1, updated_at = NOW()
             WHERE wallet_db_id = $2 AND user_id = $3 RETURNING *`,
            [label, walletDbId, userId]
        );
        if (!res.rows.length) throw new AppError('Wallet not found', 404);
        return res.rows[0];
    }

    /** Set this wallet as the user's seller payout wallet (sync to seller_profiles). */
    async setSellerPayout(userId: number, walletDbId: number) {
        const walletRes = await query(
            `SELECT * FROM user_wallets WHERE wallet_db_id = $1 AND user_id = $2`,
            [walletDbId, userId]
        );
        if (!walletRes.rows.length) throw new AppError('Wallet not found', 404);
        const wallet = walletRes.rows[0];
        if (wallet.chain_type !== 'evm') {
            throw new AppError('Only EVM wallets can be used as seller payout wallet', 400);
        }
        if (!wallet.is_verified) {
            throw new AppError('Wallet must be verified before being used as payout wallet', 400);
        }

        const sellerRes = await query(
            `SELECT seller_id FROM seller_profiles WHERE user_id = $1`,
            [userId]
        );
        if (!sellerRes.rows.length) {
            throw new AppError('You do not have a seller profile', 400);
        }

        await query(
            `UPDATE seller_profiles SET payout_wallet = $1, updated_at = NOW() WHERE user_id = $2`,
            [wallet.address, userId]
        );
        logger.info('Seller payout wallet updated', { user_id: userId, wallet: wallet.address });
        return { payout_wallet: wallet.address };
    }

    async removeWallet(userId: number, walletDbId: number) {
        const existing = await query(
            'SELECT * FROM user_wallets WHERE wallet_db_id = $1 AND user_id = $2',
            [walletDbId, userId]
        );
        if (!existing.rows.length) throw new AppError('Wallet not found', 404);
        const wallet = existing.rows[0];

        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM user_wallets WHERE wallet_db_id = $1', [walletDbId]);

            // If we removed the primary wallet, promote the oldest remaining one
            let newPrimary: any = null;
            if (wallet.is_primary) {
                const next = await client.query(
                    `SELECT wallet_db_id, address, chain_type FROM user_wallets
                     WHERE user_id = $1
                     ORDER BY is_verified DESC, created_at ASC, wallet_db_id ASC
                     LIMIT 1`,
                    [userId]
                );
                if (next.rows.length) {
                    newPrimary = next.rows[0];
                    await client.query(
                        `UPDATE user_wallets SET is_primary = TRUE, updated_at = NOW() WHERE wallet_db_id = $1`,
                        [newPrimary.wallet_db_id]
                    );
                }
            }

            // Sync users.wallet_address: if removed wallet was the linked one, point it to new primary or null
            if (wallet.chain_type === 'evm') {
                const userRow = await client.query(
                    `SELECT wallet_address FROM users WHERE user_id = $1`,
                    [userId]
                );
                const linked = userRow.rows[0]?.wallet_address?.toLowerCase();
                if (linked && linked === wallet.address.toLowerCase()) {
                    const replacement = newPrimary && newPrimary.chain_type === 'evm' ? newPrimary.address : null;
                    await client.query(
                        `UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE user_id = $2`,
                        [replacement, userId]
                    );
                }

                // Also clear seller payout if it pointed at the removed wallet
                await client.query(
                    `UPDATE seller_profiles SET payout_wallet = NULL, updated_at = NOW()
                     WHERE user_id = $1 AND LOWER(payout_wallet) = $2`,
                    [userId, wallet.address.toLowerCase()]
                );
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw err;
        } finally {
            client.release();
        }
    }

    async setPrimary(userId: number, walletDbId: number) {
        const existing = await query(
            'SELECT * FROM user_wallets WHERE wallet_db_id = $1 AND user_id = $2',
            [walletDbId, userId]
        );
        if (!existing.rows.length) throw new AppError('Wallet not found', 404);
        const wallet = existing.rows[0];

        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE user_wallets SET is_primary = FALSE WHERE user_id = $1`, [userId]);
            await client.query(
                `UPDATE user_wallets SET is_primary = TRUE, updated_at = NOW() WHERE wallet_db_id = $1`,
                [walletDbId]
            );

            // Keep users.wallet_address aligned with the primary EVM wallet
            if (wallet.chain_type === 'evm') {
                await client.query(
                    `UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE user_id = $2`,
                    [wallet.address, userId]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw err;
        } finally {
            client.release();
        }
    }

    async getDepositHistory(userId: number, status?: string) {
        const where = status ? `AND wd.status = $2` : '';
        const params: any[] = [userId];
        if (status) params.push(status);

        const res = await query(
            `SELECT wd.*, tw.symbol, tw.decimals, tw.metadata->>'chain' AS chain_name,
                    di.reference_code, di.expected_amount AS intent_expected_amount
             FROM wallet_deposits wd
             JOIN token_whitelist tw ON wd.token_id = tw.token_id
             LEFT JOIN wallet_deposit_intents di ON di.intent_id = wd.intent_id
             WHERE wd.user_id = $1 ${where}
             ORDER BY wd.created_at DESC
             LIMIT 50`,
            params
        );
        return res.rows;
    }

    /* ─────────────────── Deposit intents (QR invoice) ─────────────────── */

    private async getPlatformDepositAddress(chainId: number): Promise<string | null> {
        const res = await query(
            `SELECT value FROM platform_config WHERE key = 'deposit_addresses'`
        );
        const addresses = res.rows[0]?.value || {};
        const addr = addresses[String(chainId)] || addresses[chainId];
        return typeof addr === 'string' && addr.startsWith('0x') ? addr : null;
    }

    /** EIP-681 payment URI for QR encoding. */
    private buildDepositUri(opts: {
        chainId: number;
        toAddress: string;
        amount: string;        // human-readable decimal string
        decimals: number;
        tokenAddress: string | null; // null → native coin
    }): string {
        const { chainId, toAddress, amount, decimals, tokenAddress } = opts;
        // Convert decimal amount to raw integer (smallest unit) using string math
        const [whole, frac = ''] = amount.split('.');
        const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
        const raw = (BigInt(whole || '0') * (10n ** BigInt(decimals)) + BigInt(padded || '0')).toString();

        if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
            return `ethereum:${toAddress}@${chainId}?value=${raw}`;
        }
        return `ethereum:${tokenAddress}@${chainId}/transfer?address=${toAddress}&uint256=${raw}`;
    }

    private generateReferenceCode(): string {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let s = 'DEP-';
        for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
        return s;
    }

    async createDepositIntent(userId: number, data: {
        chain_id: number;
        token_id: number;
        amount: string | number;
        from_address: string;
        ttl_minutes?: number;
    }) {
        const ttl = Math.max(1, Math.min(60, data.ttl_minutes ?? 15));
        const amount = String(data.amount).trim();
        if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
            throw new AppError('Invalid amount', 400);
        }

        // Verify the from-wallet is owned + verified by this user
        const fromAddr = data.from_address.toLowerCase();
        const walletRes = await query(
            `SELECT * FROM user_wallets
             WHERE user_id = $1 AND chain_type = 'evm' AND LOWER(address) = $2 AND is_verified = TRUE
             LIMIT 1`,
            [userId, fromAddr]
        );
        if (!walletRes.rows.length) {
            throw new AppError('You can only create a deposit intent from a verified wallet you own', 400);
        }

        // Verify token belongs to chain
        const tokenRes = await query(
            `SELECT * FROM token_whitelist WHERE token_id = $1 AND chain_id = $2 AND is_active = TRUE`,
            [data.token_id, data.chain_id]
        );
        if (!tokenRes.rows.length) {
            throw new AppError('Token is not active on this chain', 400);
        }
        const token = tokenRes.rows[0];

        const platformAddr = await this.getPlatformDepositAddress(data.chain_id);
        if (!platformAddr) {
            throw new AppError(`Platform deposit address is not configured for chain ${data.chain_id}`, 400);
        }

        // Cancel duplicate-pending intents from same from_address with same amount
        await query(
            `UPDATE wallet_deposit_intents
             SET status = 'cancelled', updated_at = NOW()
             WHERE user_id = $1 AND chain_id = $2 AND token_id = $3
               AND LOWER(from_address) = $4 AND expected_amount = $5::numeric
               AND status = 'pending'`,
            [userId, data.chain_id, data.token_id, fromAddr, amount]
        );

        let referenceCode = '';
        for (let attempt = 0; attempt < 5; attempt++) {
            referenceCode = this.generateReferenceCode();
            const exists = await query(
                `SELECT 1 FROM wallet_deposit_intents WHERE reference_code = $1`,
                [referenceCode]
            );
            if (!exists.rows.length) break;
            referenceCode = '';
        }
        if (!referenceCode) {
            throw new AppError('Failed to generate reference code, retry', 500);
        }

        const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
        const insert = await query(
            `INSERT INTO wallet_deposit_intents
                (user_id, chain_id, token_id, expected_amount, from_address, to_address, reference_code, expires_at)
             VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,$8)
             RETURNING *`,
            [userId, data.chain_id, data.token_id, amount, fromAddr, platformAddr.toLowerCase(), referenceCode, expiresAt]
        );

        const intent = insert.rows[0];
        const uri = this.buildDepositUri({
            chainId: data.chain_id,
            toAddress: platformAddr,
            amount,
            decimals: token.decimals,
            tokenAddress: token.token_address,
        });

        logger.info('Deposit intent created', {
            user_id: userId, chain_id: data.chain_id, token: token.symbol,
            amount, from_address: fromAddr, reference: referenceCode,
        });

        return {
            ...intent,
            token_symbol: token.symbol,
            token_address: token.token_address,
            token_decimals: token.decimals,
            chain_info: CHAIN_INFO[data.chain_id] || { name: `Chain ${data.chain_id}`, type: 'evm' },
            payment_uri: uri,
        };
    }

    async listDepositIntents(userId: number) {
        const res = await query(
            `SELECT di.*, tw.symbol AS token_symbol, tw.decimals AS token_decimals,
                    tw.token_address,
                    wd.tx_hash AS matched_tx_hash, wd.status AS deposit_status,
                    wd.confirmations AS deposit_confirmations
             FROM wallet_deposit_intents di
             JOIN token_whitelist tw ON di.token_id = tw.token_id
             LEFT JOIN wallet_deposits wd ON wd.intent_id = di.intent_id
             WHERE di.user_id = $1
             ORDER BY di.created_at DESC
             LIMIT 50`,
            [userId]
        );
        // Also auto-expire any past-due pending intents for cleanliness
        await query(
            `UPDATE wallet_deposit_intents
             SET status = 'expired', updated_at = NOW()
             WHERE user_id = $1 AND status = 'pending' AND expires_at < NOW()`,
            [userId]
        );
        return res.rows.map(row => ({
            ...row,
            chain_info: CHAIN_INFO[row.chain_id] || { name: `Chain ${row.chain_id}`, type: 'evm' },
            payment_uri: this.buildDepositUri({
                chainId: row.chain_id,
                toAddress: row.to_address,
                amount: String(row.expected_amount),
                decimals: row.token_decimals,
                tokenAddress: row.token_address,
            }),
        }));
    }

    async cancelDepositIntent(userId: number, intentId: number) {
        const res = await query(
            `UPDATE wallet_deposit_intents
             SET status = 'cancelled', updated_at = NOW()
             WHERE intent_id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING *`,
            [intentId, userId]
        );
        if (!res.rows.length) {
            throw new AppError('Intent not found or already finalised', 404);
        }
        return res.rows[0];
    }

    async getDepositAddresses() {
        // Return platform deposit addresses per chain from platform_config
        const res = await query(
            `SELECT value FROM platform_config WHERE key = 'deposit_addresses'`
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
