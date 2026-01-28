import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { createOrder, getOrders, getOrder, cancelOrder } from './orders.controller';

const router = Router();

router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
router.post('/:id/cancel', authenticate, cancelOrder);

export default router;
