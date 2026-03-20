import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { getPendingReward } from '../../blockchain/factory';

export const portfolioRouter = Router();

/** Get a user's holdings across all assets */
portfolioRouter.get('/:userId', async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT
        h.asset_id, h.tokens_held, h.avg_cost_usd, h.total_claimed_profit,
        a.name, a.asset_type, a.price_per_token_usd, a.token_contract_address, a.distributor_contract_address,
        a.expected_apy, a.status,
        (h.tokens_held * a.price_per_token_usd) AS current_value_usd
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
        const pendingEth = (BigInt(pendingWei) * 10000n / BigInt(1e18)).toString(); // 4 decimal
        res.json({ pending_wei: pendingWei, pending_eth: (Number(pendingWei) / 1e18).toFixed(6) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Admin: Record token purchase (mint tokens to investor) */
portfolioRouter.post('/purchase', async (req: Request, res: Response) => {
    const { asset_id, user_id, wallet_address, token_amount, cost_usd } = req.body;
    try {
        // Upsert holdings
        await query(`
      INSERT INTO investor_holdings (user_id, asset_id, tokens_held, avg_cost_usd)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, asset_id) DO UPDATE SET
        tokens_held = investor_holdings.tokens_held + $3,
        avg_cost_usd = (investor_holdings.avg_cost_usd * investor_holdings.tokens_held + $4 * $3) / (investor_holdings.tokens_held + $3)
    `, [user_id, asset_id, token_amount, cost_usd / token_amount]);

        // Update tokens_sold on asset
        await query(`UPDATE rwa_assets SET tokens_sold = tokens_sold + $1 WHERE asset_id = $2`, [token_amount, asset_id]);

        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
