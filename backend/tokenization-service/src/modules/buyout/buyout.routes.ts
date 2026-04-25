import { Router, Request, Response } from 'express';
import { pool, query } from '../../db';
import { isAddress } from 'ethers';
import { buildBuyoutMerkleSnapshot } from './merkle';

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
    if (!isAddress(buyer_address)) {
        return res.status(400).json({ error: 'Invalid buyer address' });
    }
    if (!governance_proposal_id) {
        return res.status(400).json({ error: 'governance_proposal_id required for buyout proposal' });
    }
    let pricePerTokenWei: bigint;
    try {
        pricePerTokenWei = BigInt(price_per_token_wei);
    } catch {
        return res.status(400).json({ error: 'price_per_token_wei must be a valid integer string' });
    }
    if (pricePerTokenWei <= 0n) {
        return res.status(400).json({ error: 'price_per_token_wei must be greater than 0' });
    }

    try {
        // Get total tokens to calculate total price
        const assetResult = await query(
            `SELECT total_tokens FROM rwa_assets WHERE asset_id = $1`, [req.params.assetId]
        );
        if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });

        const totalTokens = assetResult.rows[0].total_tokens;
        const totalPriceWei = (BigInt(price_per_token_wei) * BigInt(totalTokens)).toString();

        const proposalResult = await query(
            `SELECT status, proposal_type
             FROM governance_proposals
             WHERE id = $1 AND asset_id = $2`,
            [governance_proposal_id, req.params.assetId]
        );
        if (proposalResult.rows.length === 0) {
            return res.status(404).json({ error: 'Governance proposal not found for this asset' });
        }
        const proposal = proposalResult.rows[0];
        if (proposal.status !== 'PASSED' || proposal.proposal_type !== 'INITIATE_BUYOUT') {
            return res.status(400).json({ error: 'Buyout requires a PASSED INITIATE_BUYOUT governance proposal' });
        }

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
    const validStatuses = ['PROPOSED', 'DEPOSITED', 'FINALIZED', 'SETTLED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    if (vault_address && !isAddress(vault_address)) {
        return res.status(400).json({ error: 'Invalid vault_address' });
    }
    if (status === 'FINALIZED' && (!merkle_root || !finalize_tx_hash)) {
        return res.status(400).json({ error: 'FINALIZED status requires merkle_root and finalize_tx_hash' });
    }
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

/** Build Merkle snapshot/proofs from current holder balances */
buyoutRouter.post('/:id/snapshot', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const buyoutResult = await client.query(
            `SELECT b.*, a.asset_id, a.total_tokens
             FROM buyout_proposals b
             JOIN rwa_assets a USING (asset_id)
             WHERE b.id = $1`,
            [req.params.id]
        );
        if (buyoutResult.rows.length === 0) return res.status(404).json({ error: 'Buyout not found' });

        const buyout = buyoutResult.rows[0];
        if (['CANCELLED', 'SETTLED'].includes(buyout.status)) {
            return res.status(400).json({ error: `Cannot snapshot a ${buyout.status} buyout` });
        }
        if (!buyout.price_per_token_wei) {
            return res.status(400).json({ error: 'Buyout is missing price_per_token_wei' });
        }

        const holdersResult = await client.query(
            `SELECT wallet_address AS holder_address, tokens_held AS token_balance
             FROM investor_holdings
             WHERE asset_id = $1 AND tokens_held > 0
             ORDER BY wallet_address ASC`,
            [buyout.asset_id]
        );

        const snapshot = buildBuyoutMerkleSnapshot(holdersResult.rows, buyout.price_per_token_wei);

        await client.query('BEGIN');
        await client.query(`DELETE FROM buyout_claim_proofs WHERE buyout_id = $1`, [req.params.id]);

        for (const claim of snapshot.claims) {
            await client.query(`
                INSERT INTO buyout_claim_proofs
                    (buyout_id, holder_address, token_balance, token_balance_wei, amount_wei, leaf_hash, proof)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            `, [
                req.params.id,
                claim.holder_address,
                claim.token_balance,
                claim.token_balance_wei,
                claim.amount_wei,
                claim.leaf_hash,
                JSON.stringify(claim.proof),
            ]);
        }

        await client.query(
            `UPDATE buyout_proposals
             SET merkle_root = $2, updated_at = NOW()
             WHERE id = $1`,
            [req.params.id, snapshot.merkle_root]
        );
        await client.query('COMMIT');

        res.json({
            merkle_root: snapshot.merkle_root,
            holder_count: snapshot.claims.length,
        });
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/** Get the Merkle proof required for a holder to claim proceeds */
buyoutRouter.get('/:id/proof/:wallet', async (req: Request, res: Response) => {
    const holder = req.params.wallet.toLowerCase();
    if (!isAddress(holder)) {
        return res.status(400).json({ error: 'Invalid holder address' });
    }

    try {
        const result = await query(`
            SELECT p.*, b.status, b.vault_address, b.merkle_root, b.claim_deadline
            FROM buyout_claim_proofs p
            JOIN buyout_proposals b ON b.id = p.buyout_id
            WHERE p.buyout_id = $1 AND p.holder_address = $2
        `, [req.params.id, holder]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No claim proof found for this wallet' });
        }

        const row = result.rows[0];
        if (row.status !== 'FINALIZED') {
            return res.status(400).json({ error: 'Buyout is not finalized on-chain yet' });
        }
        if (!row.vault_address || !row.merkle_root) {
            return res.status(400).json({ error: 'Buyout vault or Merkle root is missing' });
        }

        res.json({
            claim: {
                holder_address: row.holder_address,
                token_balance: row.token_balance,
                token_balance_wei: row.token_balance_wei,
                amount_wei: row.amount_wei,
                proof: row.proof || [],
                vault_address: row.vault_address,
                merkle_root: row.merkle_root,
                claim_deadline: row.claim_deadline,
            },
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Record a claim */
buyoutRouter.post('/:id/claim', async (req: Request, res: Response) => {
    const { holder_address, amount_wei, tx_hash } = req.body;
    if (!holder_address || !amount_wei) {
        return res.status(400).json({ error: 'holder_address and amount_wei required' });
    }
    if (!isAddress(holder_address)) {
        return res.status(400).json({ error: 'Invalid holder address' });
    }
    if (!tx_hash) {
        return res.status(400).json({ error: 'On-chain claim transaction required before recording claim' });
    }
    // Reject zero-value claims — these indicate frontend sent placeholder data
    let claimAmountWei: bigint;
    try {
        claimAmountWei = BigInt(amount_wei);
    } catch {
        return res.status(400).json({ error: 'amount_wei must be a valid integer string' });
    }
    if (claimAmountWei <= 0n) {
        return res.status(400).json({ error: 'amount_wei must be greater than 0' });
    }
    try {
        const proofResult = await query(`
            SELECT p.token_balance, p.token_balance_wei, p.amount_wei, b.status
            FROM buyout_claim_proofs p
            JOIN buyout_proposals b ON b.id = p.buyout_id
            WHERE p.buyout_id = $1 AND p.holder_address = $2
        `, [req.params.id, holder_address.toLowerCase()]);
        if (proofResult.rows.length === 0) {
            return res.status(404).json({ error: 'No claim proof found for this wallet' });
        }
        const proof = proofResult.rows[0];
        if (proof.status !== 'FINALIZED') {
            return res.status(400).json({ error: 'Buyout is not finalized on-chain yet' });
        }
        if (BigInt(proof.amount_wei) !== claimAmountWei) {
            return res.status(400).json({ error: 'Claim amount does not match stored Merkle proof' });
        }

        await query(`
            INSERT INTO buyout_claims (buyout_id, holder_address, token_balance, token_balance_wei, amount_wei, tx_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (buyout_id, holder_address) DO NOTHING
        `, [
            req.params.id,
            holder_address.toLowerCase(),
            proof.token_balance,
            proof.token_balance_wei,
            amount_wei,
            tx_hash,
        ]);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
