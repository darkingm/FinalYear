import { Router, Request, Response } from 'express';
import { query } from '../../db';

export const governanceRouter = Router();

/** List proposals for an asset */
governanceRouter.get('/:assetId/proposals', async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string;
        let sql = `
            SELECT p.*,
                (SELECT COUNT(*) FROM governance_votes v WHERE v.proposal_id = p.id) AS vote_count
            FROM governance_proposals p
            WHERE p.asset_id = $1
        `;
        const params: any[] = [req.params.assetId];

        if (status) {
            sql += ` AND p.status = $2`;
            params.push(status);
        }
        sql += ` ORDER BY p.created_at DESC LIMIT 50`;

        const result = await query(sql, params);
        res.json({ proposals: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get single proposal detail with voter list */
governanceRouter.get('/proposals/:id', async (req: Request, res: Response) => {
    try {
        const proposalResult = await query(
            `SELECT * FROM governance_proposals WHERE id = $1`,
            [req.params.id]
        );
        if (proposalResult.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        const votesResult = await query(
            `SELECT voter_address, support, weight, tx_hash, voted_at
             FROM governance_votes WHERE proposal_id = $1
             ORDER BY weight DESC`,
            [req.params.id]
        );

        res.json({
            proposal: proposalResult.rows[0],
            votes: votesResult.rows,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Create a new proposal (record in DB — on-chain tx done by frontend) */
governanceRouter.post('/:assetId/proposals', async (req: Request, res: Response) => {
    const { proposer_address, proposal_type, title, description, ipfs_doc, onchain_id, snapshot_block, tx_hash, voting_deadline } = req.body;

    if (!proposer_address || !proposal_type || !title) {
        return res.status(400).json({ error: 'Missing required fields: proposer_address, proposal_type, title' });
    }

    try {
        // Look up asset quorum thresholds
        const assetResult = await query(
            `SELECT control_threshold, supermajority_threshold FROM rwa_assets WHERE asset_id = $1`,
            [req.params.assetId]
        );
        const thresholds = assetResult.rows[0] || { control_threshold: 50, supermajority_threshold: 67 };
        const isSupermajority = ['SELL_ASSET', 'INITIATE_BUYOUT', 'REPLACE_OPERATOR'].includes(proposal_type);
        const quorumRequired = isSupermajority
            ? Number(thresholds.supermajority_threshold)
            : Number(thresholds.control_threshold);

        const result = await query(`
            INSERT INTO governance_proposals
                (asset_id, proposer_address, proposal_type, title, description, ipfs_doc,
                 onchain_id, snapshot_block, quorum_required, voting_deadline, tx_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            req.params.assetId, proposer_address, proposal_type, title,
            description || '', ipfs_doc || '', onchain_id || null,
            snapshot_block || null, quorumRequired,
            voting_deadline || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            tx_hash || null,
        ]);

        res.status(201).json({ proposal: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Record a vote (synced from on-chain event) */
governanceRouter.post('/proposals/:id/vote', async (req: Request, res: Response) => {
    const { voter_address, support, weight, tx_hash } = req.body;

    if (!voter_address || support === undefined) {
        return res.status(400).json({ error: 'Missing required fields: voter_address, support' });
    }

    try {
        // Record vote
        await query(`
            INSERT INTO governance_votes (proposal_id, voter_address, support, weight, tx_hash)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (proposal_id, voter_address) DO NOTHING
        `, [req.params.id, voter_address, support, weight || 0, tx_hash || null]);

        // Update vote tallies
        if (support) {
            await query(
                `UPDATE governance_proposals SET for_votes = for_votes + $2, updated_at = NOW() WHERE id = $1`,
                [req.params.id, weight || 0]
            );
        } else {
            await query(
                `UPDATE governance_proposals SET against_votes = against_votes + $2, updated_at = NOW() WHERE id = $1`,
                [req.params.id, weight || 0]
            );
        }

        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Execute a passed proposal (update status) */
governanceRouter.post('/proposals/:id/execute', async (req: Request, res: Response) => {
    const { execute_tx_hash } = req.body;
    try {
        const result = await query(`
            UPDATE governance_proposals
            SET status = 'EXECUTED', execute_tx_hash = $2, updated_at = NOW()
            WHERE id = $1 AND status = 'PASSED'
            RETURNING *
        `, [req.params.id, execute_tx_hash || null]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Proposal not found or not in PASSED status' });
        }

        res.json({ proposal: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
