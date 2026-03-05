import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { createOrder, getOrders, getOrder, getOrderByInternalId, cancelOrder, updateOrderStatus } from './orders.controller';

const router = Router();

router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/internal/:internalOrderId', authenticate, getOrderByInternalId);
router.get('/:id', authenticate, getOrder);
router.post('/:id/cancel', authenticate, cancelOrder);
router.patch('/:id/status', authenticate, updateOrderStatus);

export default router;
