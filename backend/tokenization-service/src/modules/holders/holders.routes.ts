import { Router, Request, Response } from 'express';
import { query } from '../../db';

export const holdersRouter = Router();

/** Get top holders for an asset with ownership percentages */
holdersRouter.get('/:assetId/holders', async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

        const result = await query(`
            SELECT
                h.wallet_address,
                h.user_id,
                h.tokens_held,
                a.total_tokens,
                CASE WHEN a.total_tokens > 0
                    THEN ROUND((h.tokens_held::NUMERIC / a.total_tokens) * 100, 4)
                    ELSE 0
                END AS ownership_percent,
                h.last_updated
            FROM investor_holdings h
            JOIN rwa_assets a USING (asset_id)
            WHERE h.asset_id = $1 AND h.tokens_held > 0
            ORDER BY h.tokens_held DESC
            LIMIT $2
        `, [req.params.assetId, limit]);

        // Mask sensitive data for public API
        const holders = result.rows.map((h: any, i: number) => {
            const addr = h.wallet_address || '';
            return {
                wallet_address: addr.length >= 10
                    ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
                    : addr,
                // user_id intentionally omitted from public response
                tokens_held: h.tokens_held,
                total_tokens: h.total_tokens,
                ownership_percent: h.ownership_percent,
                last_updated: h.last_updated,
                is_largest_holder: i === 0,
                rank: i + 1,
            };
        });

        res.json({ holders });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get ownership concentration metrics for an asset */
holdersRouter.get('/:assetId/concentration', async (req: Request, res: Response) => {
    try {
        const result = await query(`
            WITH holder_shares AS (
                SELECT
                    h.tokens_held,
                    a.total_tokens,
                    CASE WHEN a.total_tokens > 0
                        THEN (h.tokens_held::NUMERIC / a.total_tokens) * 100
                        ELSE 0
                    END AS pct
                FROM investor_holdings h
                JOIN rwa_assets a USING (asset_id)
                WHERE h.asset_id = $1 AND h.tokens_held > 0
                ORDER BY h.tokens_held DESC
            ),
            ranked AS (
                SELECT pct, ROW_NUMBER() OVER (ORDER BY pct DESC) AS rank
                FROM holder_shares
            )
            SELECT
                (SELECT COALESCE(MAX(pct), 0) FROM ranked WHERE rank = 1) AS largest_holder_percent,
                (SELECT COALESCE(SUM(pct), 0) FROM ranked WHERE rank <= 5) AS top5_percent,
                (SELECT COALESCE(SUM(pct), 0) FROM ranked WHERE rank <= 10) AS top10_percent,
                (SELECT COALESCE(SUM(pct * pct), 0) FROM holder_shares) AS herfindahl_index,
                (SELECT COUNT(*) FROM holder_shares) AS total_holders
        `, [req.params.assetId]);

        const row = result.rows[0];
        const largestPercent = parseFloat(row.largest_holder_percent);

        res.json({
            concentration: {
                largest_holder_percent: parseFloat(row.largest_holder_percent).toFixed(2),
                top5_percent: parseFloat(row.top5_percent).toFixed(2),
                top10_percent: parseFloat(row.top10_percent).toFixed(2),
                herfindahl_index: parseFloat(row.herfindahl_index).toFixed(2),
                total_holders: parseInt(row.total_holders, 10),
                // Risk flags
                is_majority_controlled: largestPercent > 50,
                is_supermajority_controlled: largestPercent > 67,
                concentration_risk: largestPercent > 67 ? 'HIGH' : largestPercent > 50 ? 'MEDIUM' : 'LOW',
            },
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
