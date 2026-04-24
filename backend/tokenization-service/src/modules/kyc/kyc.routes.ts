import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { setKYCOnChain } from '../../blockchain/factory';

export const kycRouter = Router();

/** Admin: Grant KYC to a user's wallet address */
kycRouter.post('/grant', async (req: Request, res: Response) => {
    const { wallet_address, user_id, jurisdiction = 'VN' } = req.body;
    if (!wallet_address) return res.status(400).json({ error: 'wallet_address required' });

    try {
        // On-chain whitelist
        await setKYCOnChain(wallet_address, true, jurisdiction);

        // Record in DB
        await query(`
      INSERT INTO rwa_kyc (wallet_address, user_id, verified, jurisdiction, granted_at)
      VALUES ($1, $2, true, $3, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET verified = true, granted_at = NOW(), jurisdiction = $3
    `, [wallet_address, user_id || null, jurisdiction]);

        res.json({ ok: true, wallet_address, kyc: 'verified' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Admin: Revoke KYC */
kycRouter.post('/revoke', async (req: Request, res: Response) => {
    const { wallet_address } = req.body;
    try {
        await setKYCOnChain(wallet_address, false);
        await query(`UPDATE rwa_kyc SET verified = false WHERE wallet_address = $1`, [wallet_address]);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Check KYC status of a wallet */
kycRouter.get('/status/:wallet', async (req: Request, res: Response) => {
    try {
        const result = await query(`SELECT * FROM rwa_kyc WHERE wallet_address = $1`, [req.params.wallet]);
        if (result.rows.length === 0) return res.json({ verified: false });
        res.json({ verified: result.rows[0].verified, ...result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Admin: List all KYC records */
kycRouter.get('/list', async (_req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT wallet_address, user_id, verified, jurisdiction, granted_at
            FROM rwa_kyc
            ORDER BY granted_at DESC NULLS LAST
        `);
        res.json({ records: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
