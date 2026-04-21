import { Router, Request, Response } from 'express';
import { pool, query } from '../../db';
import { getPendingReward, mintTokens } from '../../blockchain/factory';
import { v4 as uuidv4 } from 'uuid';

export const portfolioRouter = Router();

/** Get a user's holdings across all assets */
portfolioRouter.get('/:userId', async (req: Request, res: Response) => {
    try {
        // With wallet-first PK, a user may have multiple wallet rows per asset.
        // Aggregate them into one row per asset for portfolio view.
        const result = await query(`
      SELECT
        h.asset_id,
        SUM(h.tokens_held) AS tokens_held,
        -- Weighted avg cost across wallets
        CASE WHEN SUM(h.tokens_held) > 0
          THEN SUM(h.avg_cost_usd * h.tokens_held) / SUM(h.tokens_held)
          ELSE 0
        END AS avg_cost_usd,
        SUM(h.total_claimed_profit) AS total_claimed_profit,
        a.name, a.asset_type, a.price_per_token_usd, a.token_contract_address, a.distributor_contract_address,
        a.expected_apy, a.status, a.total_tokens,
        (SUM(h.tokens_held) * a.price_per_token_usd) AS current_value_usd,
        CASE WHEN a.total_tokens > 0 THEN ROUND((SUM(h.tokens_held)::NUMERIC / a.total_tokens) * 100, 4) ELSE 0 END AS ownership_percent,
        ARRAY_AGG(h.wallet_address) AS wallet_addresses
      FROM investor_holdings h
      JOIN rwa_assets a USING (asset_id)
      WHERE h.user_id = $1
      GROUP BY h.asset_id, a.name, a.asset_type, a.price_per_token_usd, a.token_contract_address,
               a.distributor_contract_address, a.expected_apy, a.status, a.total_tokens
      ORDER BY current_value_usd DESC
    `, [req.params.userId]);

        res.json({ holdings: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get pending claimable reward for a wallet address on a specific asset */
portfolioRouter.get('/:assetId/pending/:walletAddress', async (req: Request, res: Response) => {
    try {
        const assetResult = await query(
            `SELECT distributor_contract_address FROM rwa_assets WHERE asset_id = $1`,
            [req.params.assetId]
        );
        if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });

        const pendingWei = await getPendingReward(
            assetResult.rows[0].distributor_contract_address,
            req.params.walletAddress
        );
        res.json({ pending_wei: pendingWei, pending_eth: (Number(pendingWei) / 1e18).toFixed(6) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Record token purchase — atomic: row-lock asset → mint on-chain → update DB
 *
 * Requires: asset_id, user_id, wallet_address, token_amount, cost_usd
 * Optional: idempotency_key (auto-generated if not provided)
 */
portfolioRouter.post('/purchase', async (req: Request, res: Response) => {
    const { asset_id, user_id, wallet_address, token_amount, cost_usd } = req.body;
    const idempotencyKey = req.body.idempotency_key || uuidv4();

    if (!asset_id || !user_id || !wallet_address || !token_amount || token_amount <= 0) {
        return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    const normalizedWallet = wallet_address.toLowerCase();
    let mintTxHash: string | undefined;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── 1. Check idempotency — reject duplicates ──────────────────
        const existingPurchase = await client.query(
            `SELECT idempotency_key, mint_tx_hash, status FROM purchase_idempotency WHERE idempotency_key = $1`,
            [idempotencyKey]
        );
        if (existingPurchase.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Duplicate purchase',
                mint_tx_hash: existingPurchase.rows[0].mint_tx_hash,
            });
        }

        // ── 2. Lock asset row + validate supply ───────────────────────
        const assetRow = await client.query(
            `SELECT token_contract_address, total_tokens, tokens_sold
             FROM rwa_assets WHERE asset_id = $1 FOR UPDATE`,
            [asset_id]
        );
        if (assetRow.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Asset not found' });
        }

        const { token_contract_address, total_tokens, tokens_sold } = assetRow.rows[0];

        if (tokens_sold + token_amount > total_tokens) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Insufficient supply: ${total_tokens - tokens_sold} tokens remaining`,
            });
        }

        if (!token_contract_address || token_contract_address === '0x0000000000000000000000000000000000000000') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Asset not yet deployed on-chain' });
        }

        // ── 2b. Write idempotency row BEFORE minting (status=PENDING) ─
        // If mint succeeds but DB commit fails, retry sees this row and rejects.
        await client.query(
            `INSERT INTO purchase_idempotency (idempotency_key, asset_id, user_id, wallet_address, token_amount, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
            [idempotencyKey, asset_id, user_id, normalizedWallet, token_amount]
        );
        await client.query('COMMIT');

        // ── 3. Mint tokens on-chain (OUTSIDE transaction) ─────────────
        try {
            const receipt = await mintTokens(
                token_contract_address,
                normalizedWallet,
                BigInt(token_amount) * 10n ** 18n
            );
            mintTxHash = receipt.hash;
        } catch (mintErr: any) {
            // Mint failed — remove the PENDING idempotency row so retry is possible
            await query(
                `DELETE FROM purchase_idempotency WHERE idempotency_key = $1 AND status = 'PENDING'`,
                [idempotencyKey]
            ).catch(() => {});
            // Record failure for manual recovery
            await query(
                `INSERT INTO failed_mint_recovery (asset_id, user_id, wallet_address, token_amount, error_message)
                 VALUES ($1, $2, $3, $4, $5)`,
                [asset_id, user_id, normalizedWallet, token_amount, mintErr.message]
            ).catch(() => {});
            return res.status(500).json({ error: `On-chain mint failed: ${mintErr.message}` });
        }

        // ── 4. Mint succeeded — update DB in a new transaction ────────
        await client.query('BEGIN');

        // Upsert holdings (wallet-first PK)
        await client.query(`
            INSERT INTO investor_holdings (user_id, asset_id, tokens_held, avg_cost_usd, wallet_address)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (asset_id, wallet_address) DO UPDATE SET
                tokens_held = investor_holdings.tokens_held + $3,
                avg_cost_usd = CASE
                    WHEN investor_holdings.tokens_held + $3 > 0
                    THEN (investor_holdings.avg_cost_usd * investor_holdings.tokens_held + $4 * $3) / (investor_holdings.tokens_held + $3)
                    ELSE $4
                END,
                user_id = COALESCE(investor_holdings.user_id, $1),
                last_updated = NOW()
        `, [user_id, asset_id, token_amount, cost_usd / token_amount, normalizedWallet]);

        // Update tokens_sold
        await client.query(
            `UPDATE rwa_assets SET tokens_sold = tokens_sold + $1, updated_at = NOW() WHERE asset_id = $2`,
            [token_amount, asset_id]
        );

        // Mark idempotency as COMPLETED with tx hash
        await client.query(
            `UPDATE purchase_idempotency SET mint_tx_hash = $2, status = 'COMPLETED' WHERE idempotency_key = $1`,
            [idempotencyKey, mintTxHash]
        );

        await client.query('COMMIT');

        res.json({
            ok: true,
            mint_tx_hash: mintTxHash,
            idempotency_key: idempotencyKey,
        });
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});

        // If mint succeeded but DB commit failed — persist tx_hash for recovery
        if (mintTxHash) {
            await query(
                `UPDATE purchase_idempotency SET mint_tx_hash = $2, status = 'COMPLETED' WHERE idempotency_key = $1`,
                [idempotencyKey, mintTxHash]
            ).catch(() => {});
        }

        console.error('[purchase] Transaction failed:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

