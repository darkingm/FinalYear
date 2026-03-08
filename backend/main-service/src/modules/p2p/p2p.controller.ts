import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { P2PService } from './p2p.service';
import { logger } from '../../utils/logger';

const p2pService = new P2PService();

// ── Offers ──────────────────────────────────────────────────────────
export async function listOffers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const filters = {
            type: req.query.type as string,
            token_id: req.query.token_id ? parseInt(req.query.token_id as string) : undefined,
            fiat: req.query.fiat as string,
            payment: req.query.payment as string,
            amount: req.query.amount ? parseFloat(req.query.amount as string) : undefined,
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
        };
        const result = await p2pService.listOffers(filters);
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
}

export async function getOffer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const offer = await p2pService.getOffer(parseInt(req.params.id));
        res.json({ success: true, data: offer });
    } catch (err) { next(err); }
}

export async function createOffer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const offer = await p2pService.createOffer(req.user!.user_id, req.body);
        res.status(201).json({ success: true, data: offer });
    } catch (err) { next(err); }
}

export async function updateOffer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const offer = await p2pService.updateOffer(req.user!.user_id, parseInt(req.params.id), req.body);
        res.json({ success: true, data: offer });
    } catch (err) { next(err); }
}

export async function pauseOffer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        await p2pService.setOfferStatus(req.user!.user_id, parseInt(req.params.id), 'PAUSED');
        res.json({ success: true, message: 'Offer paused' });
    } catch (err) { next(err); }
}

export async function resumeOffer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        await p2pService.setOfferStatus(req.user!.user_id, parseInt(req.params.id), 'ACTIVE');
        res.json({ success: true, message: 'Offer resumed' });
    } catch (err) { next(err); }
}

// ── Orders ──────────────────────────────────────────────────────────
export async function getMyOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const role = req.query.role === 'seller' ? 'seller' : 'buyer';
        const status = req.query.status as string;
        const orders = await p2pService.getMyOrders(req.user!.user_id, role, status);
        res.json({ success: true, data: orders });
    } catch (err) { next(err); }
}

export async function getOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const order = await p2pService.getOrder(parseInt(req.params.id), req.user!.user_id);
        res.json({ success: true, data: order });
    } catch (err) { next(err); }
}

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const order = await p2pService.createOrder(req.user!.user_id, req.body);
        res.status(201).json({ success: true, data: order });
    } catch (err) { next(err); }
}

export async function markAsPaid(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        // payment_proof is array of already-uploaded Cloudinary URLs
        const { payment_method, proof_urls } = req.body;
        const order = await p2pService.markAsPaid(
            parseInt(req.params.id), req.user!.user_id, payment_method, proof_urls || []
        );
        res.json({ success: true, data: order });
    } catch (err) { next(err); }
}

export async function uploadProof(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const files = (req as any).files as Array<{ buffer: Buffer; originalname: string; mimetype: string }> || [];
        if (!files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
        const { uploadToCloudinary } = await import('../../config/cloudinary');
        const urls: string[] = [];
        for (const f of files) { urls.push(await uploadToCloudinary(f.buffer, 'p2p-proofs')); }
        res.json({ success: true, urls });
    } catch (err) { next(err); }
}

export async function confirmPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const order = await p2pService.confirmPayment(parseInt(req.params.id), req.user!.user_id);
        res.json({ success: true, data: order });
    } catch (err) { next(err); }
}

export async function cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { reason } = req.body;
        const order = await p2pService.cancelOrder(parseInt(req.params.id), req.user!.user_id, reason);
        res.json({ success: true, data: order });
    } catch (err) { next(err); }
}

export async function openDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { reason, description, evidence_urls } = req.body;
        const dispute = await p2pService.openDispute(
            parseInt(req.params.id), req.user!.user_id, reason, description, evidence_urls || []
        );
        res.status(201).json({ success: true, data: dispute });
    } catch (err) { next(err); }
}

// ── Messages ─────────────────────────────────────────────────────────
export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const msgs = await p2pService.getMessages(parseInt(req.params.id), req.user!.user_id);
        res.json({ success: true, data: msgs });
    } catch (err) { next(err); }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { message, attachments } = req.body;
        const msg = await p2pService.sendMessage(
            parseInt(req.params.id), req.user!.user_id, message, attachments || []
        );
        res.status(201).json({ success: true, data: msg });
    } catch (err) { next(err); }
}

// ── Admin ─────────────────────────────────────────────────────────────
export async function adminListDisputes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const disputes = await p2pService.adminListDisputes(req.query.status as string);
        res.json({ success: true, data: disputes });
    } catch (err) { next(err); }
}

export async function adminResolveDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { resolution, admin_notes } = req.body;
        await p2pService.adminResolveDispute(
            parseInt(req.params.dispute_id), req.user!.user_id, resolution, admin_notes
        );
        res.json({ success: true, message: 'Dispute resolved' });
    } catch (err) { next(err); }
}
