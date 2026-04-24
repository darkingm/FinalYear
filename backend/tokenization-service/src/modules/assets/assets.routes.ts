import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db';
import { createAssetOnChain } from '../../blockchain/factory';

export const assetsRouter = Router();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/* ─── List assets (default: ACTIVE only; ?status=ALL for admin) ───────── */
assetsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const statusFilter = (req.query.status as string || 'ACTIVE').toUpperCase();
        const validStatuses = ['ACTIVE', 'PENDING', 'FAILED', 'CLOSED', 'ALL'];
        if (!validStatuses.includes(statusFilter)) {
            return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}` });
        }

        let sql = `
      SELECT asset_id, name, symbol, asset_type, description, location,
             total_valuation_usd, price_per_token_usd, total_tokens,
             tokens_sold, token_contract_address, distributor_contract_address,
             legal_doc_ipfs, expected_apy, status, created_at
      FROM rwa_assets
    `;
        const params: any[] = [];
        if (statusFilter !== 'ALL') {
            sql += ` WHERE status = $1`;
            params.push(statusFilter);
        }
        sql += ` ORDER BY created_at DESC`;

        const result = await query(sql, params);
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

/* ─── Admin: Create asset (no blockchain) ────────────────────────────── */
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
        // 1. Create DB record first (always succeeds)
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

        // 2. Try blockchain deploy — optional, skip if unavailable (local dev)
        let tokenAddress = '0x0000000000000000000000000000000000000000';
        let distributorAddress = '0x0000000000000000000000000000000000000000';
        let onChain = false;

        try {
            const assetTypeMap: Record<string, number> = {
                REAL_ESTATE: 0, BOND: 1, EQUITY: 2, COMMODITY: 3,
            };
            const assetTypeEnum = assetTypeMap[asset_type] ?? 0;
            const result = await createAssetOnChain({
                assetId, name, symbol, assetType: assetTypeEnum,
                legalDocIPFS: legal_doc_ipfs || '',
                totalValUSD: BigInt(Math.round(Number(total_valuation_usd) * 1e6)),
                pricePerTokenUSD: BigInt(Math.round(Number(price_per_token_usd) * 1e6)),
            });
            tokenAddress = result.tokenAddress;
            distributorAddress = result.distributorAddress;
            onChain = true;
        } catch (_blockchainErr) {
            // Blockchain not available (Hardhat not running locally) — continue with placeholder
            console.warn(`[RWA] Blockchain unavailable for ${symbol}, saving with placeholder addresses`);
        }

        // 3. Update with contract addresses (placeholder or real)
        await query(`
      UPDATE rwa_assets
      SET token_contract_address = $1, distributor_contract_address = $2
      WHERE asset_id = $3
    `, [tokenAddress, distributorAddress, assetId]);

        res.status(201).json({
            asset_id: assetId,
            token_contract_address: tokenAddress,
            distributor_contract_address: distributorAddress,
            on_chain: onChain,
        });
    } catch (err: any) {
        await query(`UPDATE rwa_assets SET status = 'FAILED' WHERE asset_id = $1`, [assetId]).catch(() => { });
        res.status(500).json({ error: err.message });
    }
});

/* ─── Admin: Update status (with on-chain deploy guard) ──────────────── */
assetsRouter.patch('/:id/status', async (req: Request, res: Response) => {
    const newStatus = req.body.status;
    const validStatuses = ['ACTIVE', 'PENDING', 'FAILED', 'CLOSED'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        // Block PENDING → ACTIVE if asset has not been deployed on-chain
        if (newStatus === 'ACTIVE') {
            const assetResult = await query(
                `SELECT token_contract_address FROM rwa_assets WHERE asset_id = $1`,
                [req.params.id]
            );
            if (assetResult.rows.length === 0) {
                return res.status(404).json({ error: 'Asset not found' });
            }
            const addr = assetResult.rows[0].token_contract_address;
            if (!addr || addr === ZERO_ADDRESS) {
                return res.status(400).json({
                    error: 'Cannot activate asset: token contract not deployed on-chain. Deploy first or retry deploy.',
                });
            }
        }

        const result = await query(
            `UPDATE rwa_assets SET status = $1, updated_at = NOW() WHERE asset_id = $2 RETURNING asset_id, status`,
            [newStatus, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ ok: true, asset_id: result.rows[0].asset_id, status: result.rows[0].status });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
