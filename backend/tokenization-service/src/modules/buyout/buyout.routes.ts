import { Router, Request, Response } from 'express';
import { query } from '../../db';

export const buyoutRouter = Router();

/** List buyout proposals for an asset */
buyoutRouter.get('/:assetId/proposals', async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT b.*, a.name AS asset_name, a.symbol, a.total_tokens
            FROM buyout_proposals b
            JOIN rwa_assets a USING (asset_id)
            WHERE b.asset_id = $1
            ORDER BY b.created_at DESC
        `, [req.params.assetId]);
        res.json({ buyouts: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get single buyout detail with claims */
buyoutRouter.get('/detail/:id', async (req: Request, res: Response) => {
    try {
        const buyoutResult = await query(
            `SELECT b.*, a.name AS asset_name, a.symbol, a.total_tokens
             FROM buyout_proposals b JOIN rwa_assets a USING (asset_id)
             WHERE b.id = $1`, [req.params.id]
        );
        if (buyoutResult.rows.length === 0) return res.status(404).json({ error: 'Buyout not found' });

        const claimsResult = await query(
            `SELECT * FROM buyout_claims WHERE buyout_id = $1 ORDER BY claimed_at DESC`,
            [req.params.id]
        );

        const totalClaimed = claimsResult.rows.reduce(
            (sum: number, c: any) => sum + Number(c.amount_wei || 0), 0
        );

        res.json({
            buyout: buyoutResult.rows[0],
            claims: claimsResult.rows,
            total_claimed_wei: totalClaimed.toString(),
            claims_count: claimsResult.rows.length,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Create a buyout proposal (after governance vote passes) */
buyoutRouter.post('/:assetId/propose', async (req: Request, res: Response) => {
    const { buyer_address, price_per_token_wei, price_per_token_usd, governance_proposal_id } = req.body;

    if (!buyer_address || !price_per_token_wei) {
        return res.status(400).json({ error: 'buyer_address and price_per_token_wei required' });
    }

    try {
        // Get total tokens to calculate total price
        const assetResult = await query(
            `SELECT total_tokens FROM rwa_assets WHERE asset_id = $1`, [req.params.assetId]
        );
        if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });

        const totalTokens = assetResult.rows[0].total_tokens;
        const totalPriceWei = (BigInt(price_per_token_wei) * BigInt(totalTokens)).toString();

        const result = await query(`
            INSERT INTO buyout_proposals
                (asset_id, governance_proposal_id, buyer_address, price_per_token_wei,
                 price_per_token_usd, total_price_wei, total_price_usd)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            req.params.assetId, governance_proposal_id || null,
            buyer_address, price_per_token_wei,
            price_per_token_usd || null, totalPriceWei,
            price_per_token_usd ? price_per_token_usd * totalTokens : null,
        ]);

        res.status(201).json({ buyout: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Update buyout status (deposit confirmed, finalized, etc.) */
buyoutRouter.patch('/:id/status', async (req: Request, res: Response) => {
    const { status, vault_address, merkle_root, claim_deadline, deposit_tx_hash, finalize_tx_hash } = req.body;
    try {
        const sets: string[] = ['status = $2', 'updated_at = NOW()'];
        const params: any[] = [req.params.id, status];
        let idx = 3;

        if (vault_address) { sets.push(`vault_address = $${idx}`); params.push(vault_address); idx++; }
        if (merkle_root) { sets.push(`merkle_root = $${idx}`); params.push(merkle_root); idx++; }
        if (claim_deadline) { sets.push(`claim_deadline = $${idx}`); params.push(claim_deadline); idx++; }
        if (deposit_tx_hash) { sets.push(`deposit_tx_hash = $${idx}`); params.push(deposit_tx_hash); idx++; }
        if (finalize_tx_hash) { sets.push(`finalize_tx_hash = $${idx}`); params.push(finalize_tx_hash); idx++; }

        const result = await query(
            `UPDATE buyout_proposals SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Buyout not found' });
        res.json({ buyout: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Record a claim */
buyoutRouter.post('/:id/claim', async (req: Request, res: Response) => {
    const { holder_address, token_balance, amount_wei, tx_hash } = req.body;
    if (!holder_address || !amount_wei) {
        return res.status(400).json({ error: 'holder_address and amount_wei required' });
    }
    try {
        await query(`
            INSERT INTO buyout_claims (buyout_id, holder_address, token_balance, amount_wei, tx_hash)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (buyout_id, holder_address) DO NOTHING
        `, [req.params.id, holder_address, token_balance || 0, amount_wei, tx_hash || null]);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
