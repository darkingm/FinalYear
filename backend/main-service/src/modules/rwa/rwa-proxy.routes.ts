import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.middleware';

const router = Router();

const TOKENIZATION_URL = process.env.TOKENIZATION_SERVICE_URL || 'http://localhost:3003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

/**
 * Proxy helper — forwards request to tokenization-service with internal key.
 */
async function proxyToTokenization(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body?: any
) {
    const url = `${TOKENIZATION_URL}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Internal-Service-Key': INTERNAL_KEY,
    };

    const response = await axios({
        method,
        url,
        data: body,
        headers,
        timeout: 30000, // blockchain ops can be slow
    });
    return response.data;
}

/* ── Public read routes (pass-through, no auth) ──────────────────────────── */
router.get('/assets', async (req: Request, res: Response) => {
    try {
        // Forward query params (e.g. ?status=ALL for admin)
        const status = req.query.status ? `?status=${req.query.status}` : '';
        const data = await proxyToTokenization('get', `/api/rwa/assets${status}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/assets/:id', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/assets/${req.params.id}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/kyc/status/:wallet', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/kyc/status/${req.params.wallet}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// KYC list (admin)
router.get('/kyc/list', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', '/api/rwa/kyc/list');
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/portfolio/:userId', authenticate, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const requestedId = parseInt(req.params.userId, 10);
        // Ownership check: users can only view own portfolio; admin can view any
        if (authReq.user!.role !== 'admin' && authReq.user!.user_id !== requestedId) {
            return res.status(403).json({ error: 'Forbidden — you can only view your own portfolio' });
        }
        const data = await proxyToTokenization('get', `/api/rwa/portfolio/${req.params.userId}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/portfolio/:assetId/pending/:walletAddress', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/portfolio/${req.params.assetId}/pending/${req.params.walletAddress}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/profit/:assetId/history', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/profit/${req.params.assetId}/history`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/profit/:assetId/stats', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/profit/${req.params.assetId}/stats`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/holders/:assetId/holders', async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit || 20;
        const data = await proxyToTokenization('get', `/api/rwa/holders/${req.params.assetId}/holders?limit=${limit}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/holders/:assetId/concentration', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/holders/${req.params.assetId}/concentration`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

/* ── Admin-only mutating routes ──────────────────────────────────────────── */

// Create asset (admin only)
router.post('/assets', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', '/api/rwa/assets', req.body);
        res.status(201).json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Update asset status (admin only)
router.patch('/assets/:id/status', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('patch', `/api/rwa/assets/${req.params.id}/status`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Grant KYC (admin only)
router.post('/kyc/grant', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', '/api/rwa/kyc/grant', req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Revoke KYC (admin only)
router.post('/kyc/revoke', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', '/api/rwa/kyc/revoke', req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Deposit profit (admin only)
router.post('/profit/:assetId/deposit', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/profit/${req.params.assetId}/deposit`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

/* ── Authenticated user routes ───────────────────────────────────────────── */

// Purchase tokens (authenticated user)
router.post('/portfolio/purchase', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('post', '/api/rwa/portfolio/purchase', {
            ...req.body,
            user_id: req.user!.user_id, // Use authenticated user ID, not body
        });
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/portfolio/reconcile/:assetId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/portfolio/reconcile/${req.params.assetId}`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

/* ── Governance routes ───────────────────────────────────────────────── */

// Public: list proposals
router.get('/governance/:assetId/proposals', async (req: Request, res: Response) => {
    try {
        const status = req.query.status ? `?status=${req.query.status}` : '';
        const data = await proxyToTokenization('get', `/api/rwa/governance/${req.params.assetId}/proposals${status}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Public: proposal detail
router.get('/governance/proposals/:id', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/governance/proposals/${req.params.id}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Authenticated: create proposal
router.post('/governance/:assetId/proposals', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/governance/${req.params.assetId}/proposals`, {
            ...req.body,
            proposer_address: req.body.proposer_address,
        });
        res.status(201).json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Authenticated: cast vote
router.post('/governance/proposals/:id/vote', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/governance/proposals/${req.params.id}/vote`, {
            ...req.body,
            user_id: req.user!.user_id,
        });
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

// Authenticated: execute proposal
router.post('/governance/proposals/:id/execute', authenticate, async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/governance/proposals/${req.params.id}/execute`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

/* ── Buyout routes ───────────────────────────────────────────────────── */

router.get('/buyout/:assetId/proposals', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/buyout/${req.params.assetId}/proposals`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/buyout/detail/:id', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/buyout/detail/${req.params.id}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/buyout/:id/proof/:wallet', authenticate, async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/buyout/${req.params.id}/proof/${req.params.wallet}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/buyout/:assetId/propose', authenticate, async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/buyout/${req.params.assetId}/propose`, req.body);
        res.status(201).json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/buyout/:id/snapshot', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/buyout/${req.params.id}/snapshot`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.patch('/buyout/:id/status', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('patch', `/api/rwa/buyout/${req.params.id}/status`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/buyout/:id/claim', authenticate, async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/buyout/${req.params.id}/claim`, req.body);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

/* ── Secondary Market routes ─────────────────────────────────────────── */

router.get('/market/:assetId/listings', async (req: Request, res: Response) => {
    try {
        const status = req.query.status ? `?status=${req.query.status}` : '';
        const data = await proxyToTokenization('get', `/api/rwa/market/${req.params.assetId}/listings${status}`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.get('/market/:assetId/trades', async (req: Request, res: Response) => {
    try {
        const data = await proxyToTokenization('get', `/api/rwa/market/${req.params.assetId}/trades`);
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/market/:assetId/list', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/market/${req.params.assetId}/list`, {
            ...req.body,
            seller_user_id: req.user!.user_id,
        });
        res.status(201).json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.patch('/market/listings/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('patch', `/api/rwa/market/listings/${req.params.id}/cancel`, {
            ...req.body,
            seller_user_id: req.user!.user_id,
        });
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

router.post('/market/listings/:id/buy', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const data = await proxyToTokenization('post', `/api/rwa/market/listings/${req.params.id}/buy`, {
            ...req.body,
            buyer_user_id: req.user!.user_id,
        });
        res.json(data);
    } catch (err: any) {
        res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
});

export default router;
