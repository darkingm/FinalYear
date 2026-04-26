import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { createOrder, getOrders, getOrder, getOrderByInternalId, cancelOrder, updateOrderStatus, handleLogisticsWebhook, checkoutCart, syncOrderFromChainController } from './orders.controller';

const router = Router();

router.post('/', authenticate, createOrder);
router.post('/checkout/cart', authenticate, checkoutCart);
router.get('/', authenticate, getOrders);
router.get('/internal/:internalOrderId', authenticate, getOrderByInternalId);
router.get('/:id', authenticate, getOrder);
router.post('/:id/cancel', authenticate, cancelOrder);
router.post('/:id/sync-from-chain', authenticate, syncOrderFromChainController);
router.patch('/:id/status', authenticate, updateOrderStatus);

// Webhook for 3rd party logistics (no auth or special API key auth in real-world, but we leave it open for simulation)
router.post('/webhook/logistics', handleLogisticsWebhook);

export default router;
