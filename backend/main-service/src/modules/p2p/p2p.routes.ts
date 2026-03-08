import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorizeRoles } from '../../middleware/auth.middleware';
import {
    listOffers, getOffer, createOffer, updateOffer, pauseOffer, resumeOffer,
    getMyOrders, getOrder, createOrder, markAsPaid, uploadProof, confirmPayment,
    cancelOrder, openDispute, getMessages, sendMessage,
    adminListDisputes, adminResolveDispute,
} from './p2p.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Public ────────────────────────────────────────────────────────────
router.get('/offers', listOffers);
router.get('/offers/:id', getOffer);

// ── Auth required ─────────────────────────────────────────────────────
router.post('/offers', authenticate, createOffer);
router.put('/offers/:id', authenticate, updateOffer);
router.patch('/offers/:id/pause', authenticate, pauseOffer);
router.patch('/offers/:id/resume', authenticate, resumeOffer);

router.get('/orders', authenticate, getMyOrders);
router.get('/orders/:id', authenticate, getOrder);
router.post('/orders', authenticate, createOrder);
router.patch('/orders/:id/paid', authenticate, markAsPaid);
router.post('/orders/:id/proof', authenticate, upload.array('files', 5), uploadProof);
router.patch('/orders/:id/confirm', authenticate, confirmPayment);
router.patch('/orders/:id/cancel', authenticate, cancelOrder);
router.post('/orders/:id/dispute', authenticate, openDispute);

router.get('/orders/:id/messages', authenticate, getMessages);
router.post('/orders/:id/messages', authenticate, sendMessage);

// ── Admin only ────────────────────────────────────────────────────────
router.get('/admin/disputes', authenticate, authorizeRoles('admin'), adminListDisputes);
router.patch('/admin/disputes/:dispute_id/resolve', authenticate, authorizeRoles('admin'), adminResolveDispute);

export default router;
