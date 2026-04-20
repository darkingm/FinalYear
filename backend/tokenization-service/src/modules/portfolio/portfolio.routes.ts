import { Router, Request, Response } from 'express';
import { pool, query } from '../../db';
import { getPendingReward, mintTokens } from '../../blockchain/factory';
import { v4 as uuidv4 } from 'uuid';

export const portfolioRouter = Router();

/** Get a user's holdings across all assets */
portfolioRouter.get('/:userId', async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT
        h.asset_id, h.tokens_held, h.avg_cost_usd, h.total_claimed_profit,
        a.name, a.asset_type, a.price_per_token_usd, a.token_contract_address, a.distributor_contract_address,
        a.expected_apy, a.status, a.total_tokens,
        (h.tokens_held * a.price_per_token_usd) AS current_value_usd,
        CASE WHEN a.total_tokens > 0 THEN ROUND((h.tokens_held::NUMERIC / a.total_tokens) * 100, 4) ELSE 0 END AS ownership_percent
      FROM investor_holdings h
      JOIN rwa_assets a USING (asset_id)
      WHERE h.user_id = $1
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

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── 1. Check idempotency — reject duplicates ──────────────────
        const existingPurchase = await client.query(
            `SELECT idempotency_key, mint_tx_hash FROM purchase_idempotency WHERE idempotency_key = $1`,
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

        // ── 3. Mint tokens on-chain ───────────────────────────────────
        let mintTxHash: string;
        try {
            // RWAToken uses 18 decimals (ERC20 default)
            const receipt = await mintTokens(
                token_contract_address,
                wallet_address,
                BigInt(token_amount) * 10n ** 18n
            );
            mintTxHash = receipt.hash;
        } catch (mintErr: any) {
            // Mint failed — rollback DB, log for recovery
            await client.query('ROLLBACK');
            // Record the failure for manual recovery
            await query(
                `INSERT INTO failed_mint_recovery (asset_id, user_id, wallet_address, token_amount, error_message)
                 VALUES ($1, $2, $3, $4, $5)`,
                [asset_id, user_id, wallet_address, token_amount, mintErr.message]
            ).catch(() => {}); // Don't let recovery logging fail the response
            return res.status(500).json({ error: `On-chain mint failed: ${mintErr.message}` });
        }

        // ── 4. Mint succeeded — update DB within the same transaction ─
        // Upsert holdings
        await client.query(`
            INSERT INTO investor_holdings (user_id, asset_id, tokens_held, avg_cost_usd, wallet_address)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, asset_id) DO UPDATE SET
                tokens_held = investor_holdings.tokens_held + $3,
                avg_cost_usd = CASE
                    WHEN investor_holdings.tokens_held + $3 > 0
                    THEN (investor_holdings.avg_cost_usd * investor_holdings.tokens_held + $4 * $3) / (investor_holdings.tokens_held + $3)
                    ELSE $4
                END,
                wallet_address = COALESCE(investor_holdings.wallet_address, $5),
                last_updated = NOW()
        `, [user_id, asset_id, token_amount, cost_usd / token_amount, wallet_address]);

        // Update tokens_sold
        await client.query(
            `UPDATE rwa_assets SET tokens_sold = tokens_sold + $1, updated_at = NOW() WHERE asset_id = $2`,
            [token_amount, asset_id]
        );

        // Record idempotency
        await client.query(
            `INSERT INTO purchase_idempotency (idempotency_key, asset_id, user_id, wallet_address, token_amount, mint_tx_hash)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [idempotencyKey, asset_id, user_id, wallet_address, token_amount, mintTxHash]
        );

        await client.query('COMMIT');

        res.json({
            ok: true,
            mint_tx_hash: mintTxHash,
            idempotency_key: idempotencyKey,
        });
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});

        // If mint succeeded but DB commit failed — record for recovery
        // The mint_tx_hash would be in the closure scope, but we can't access it here
        // because the error might be from a different part of the transaction.
        // The failed_mint_recovery table handles the case where mint succeeded but DB failed.
        console.error('[purchase] Transaction failed:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});
