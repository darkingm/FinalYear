import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { depositProfitOnChain, getOnChainStats } from '../../blockchain/factory';

export const profitRouter = Router();

/** Admin: Deposit profit for an asset */
profitRouter.post('/:assetId/deposit', async (req: Request, res: Response) => {
    const { amount_eth, description } = req.body;
    if (!amount_eth) return res.status(400).json({ error: 'amount_eth required' });

    try {
        // Get distributor address
        const assetResult = await query(
            `SELECT distributor_contract_address, name FROM rwa_assets WHERE asset_id = $1`,
            [req.params.assetId]
        );
        if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
        const { distributor_contract_address, name } = assetResult.rows[0];

        const desc = description || `Profit distribution for ${name}`;
        const receipt = await depositProfitOnChain(distributor_contract_address, amount_eth.toString(), desc);

        // Record distribution
        await query(`
      INSERT INTO profit_distributions (asset_id, amount_eth, amount_usd, tx_hash, period_description)
      VALUES ($1, $2, 0, $3, $4)
    `, [req.params.assetId, amount_eth, receipt.hash, desc]);

        res.json({ ok: true, tx_hash: receipt.hash });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get distribution history for an asset */
profitRouter.get('/:assetId/history', async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT * FROM profit_distributions WHERE asset_id = $1 ORDER BY distributed_at DESC LIMIT 50
    `, [req.params.assetId]);
        res.json({ distributions: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** On-chain stats merged with DB stats for asset */
profitRouter.get('/:assetId/stats', async (req: Request, res: Response) => {
    try {
        const assetResult = await query(
            `SELECT token_contract_address, distributor_contract_address FROM rwa_assets WHERE asset_id = $1`,
            [req.params.assetId]
        );
        if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
        const { token_contract_address, distributor_contract_address } = assetResult.rows[0];

        // Get on-chain stats
        const onChainStats = await getOnChainStats(token_contract_address, distributor_contract_address);

        // Get DB distribution count
        const countResult = await query(
            `SELECT COUNT(*) AS distribution_count FROM profit_distributions WHERE asset_id = $1`,
            [req.params.assetId]
        );

        // Merge on-chain + DB stats into a unified response
        const stats = {
            totalSupply: onChainStats.totalSupply,
            tokensAvailable: onChainStats.tokensAvailable,
            tokensSold: onChainStats.tokensSold,
            totalDepositedWei: onChainStats.totalDepositedWei,
            totalDepositedEth: (Number(onChainStats.totalDepositedWei) / 1e18).toFixed(6),
            totalClaimedWei: onChainStats.totalClaimedWei,
            totalClaimedEth: (Number(onChainStats.totalClaimedWei) / 1e18).toFixed(6),
            distributionCount: parseInt(countResult.rows[0].distribution_count, 10),
        };

        res.json({ stats });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
