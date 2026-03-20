import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db';
import { createAssetOnChain } from '../../blockchain/factory';

export const assetsRouter = Router();

/* ─── List all active assets ─────────────────────────────────────────── */
assetsRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT asset_id, name, asset_type, description, location,
             total_valuation_usd, price_per_token_usd, total_tokens,
             tokens_sold, token_contract_address, distributor_contract_address,
             legal_doc_ipfs, expected_apy, status, created_at
      FROM rwa_assets
      WHERE status = 'ACTIVE'
      ORDER BY created_at DESC
    `);
        res.json({ assets: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── Get single asset ───────────────────────────────────────────────── */
assetsRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT a.*,
             (SELECT COUNT(*) FROM investor_holdings WHERE asset_id = a.asset_id) AS holder_count,
             COALESCE((SELECT SUM(amount_usd) FROM profit_distributions WHERE asset_id = a.asset_id), 0) AS total_distributed_usd
      FROM rwa_assets a
      WHERE a.asset_id = $1
    `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
        res.json({ asset: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/* ─── Admin: Create asset ────────────────────────────────────────────── */
assetsRouter.post('/', async (req: Request, res: Response) => {
    const {
        name, symbol, asset_type, description, location,
        total_valuation_usd, price_per_token_usd, legal_doc_ipfs, expected_apy,
    } = req.body;

    if (!name || !symbol || !asset_type || !total_valuation_usd || !price_per_token_usd) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const assetId = uuidv4();
    const totalTokens = Math.floor(Number(total_valuation_usd) / Number(price_per_token_usd));

    try {
        // 1. Create DB record (status=PENDING until on-chain deployment confirmed)
        await query(`
      INSERT INTO rwa_assets (
        asset_id, name, symbol, asset_type, description, location,
        total_valuation_usd, price_per_token_usd, total_tokens,
        legal_doc_ipfs, expected_apy, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING')
    `, [
            assetId, name, symbol, asset_type, description || '', location || '',
            total_valuation_usd, price_per_token_usd, totalTokens,
            legal_doc_ipfs || '', expected_apy || null,
        ]);

        // 2. Deploy on-chain (async — update status after)
        const assetTypeMap: Record<string, number> = {
            REAL_ESTATE: 0, BOND: 1, EQUITY: 2, COMMODITY: 3,
        };
        const assetTypeEnum = assetTypeMap[asset_type] ?? 0;

        const { tokenAddress, distributorAddress } = await createAssetOnChain({
            assetId, name, symbol, assetType: assetTypeEnum,
            legalDocIPFS: legal_doc_ipfs || '',
            totalValUSD: BigInt(Math.round(Number(total_valuation_usd) * 1e6)),
            pricePerTokenUSD: BigInt(Math.round(Number(price_per_token_usd) * 1e6)),
        });

        // 3. Update with contract addresses
        await query(`
      UPDATE rwa_assets
      SET token_contract_address = $1, distributor_contract_address = $2, status = 'ACTIVE'
      WHERE asset_id = $3
    `, [tokenAddress, distributorAddress, assetId]);

        res.status(201).json({ asset_id: assetId, token_contract_address: tokenAddress, distributor_contract_address: distributorAddress });
    } catch (err: any) {
        // Mark as failed
        await query(`UPDATE rwa_assets SET status = 'FAILED' WHERE asset_id = $1`, [assetId]).catch(() => { });
        res.status(500).json({ error: err.message });
    }
});

/* ─── Admin: Update status ───────────────────────────────────────────── */
assetsRouter.patch('/:id/status', async (req: Request, res: Response) => {
    try {
        await query(`UPDATE rwa_assets SET status = $1 WHERE asset_id = $2`, [req.body.status, req.params.id]);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
