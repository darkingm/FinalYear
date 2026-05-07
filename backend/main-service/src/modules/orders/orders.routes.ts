import { Router, Request, Response, NextFunction } from 'express';
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

/**
 * Logistics webhook — must come from a trusted carrier callback URL.
 * Previously open ("we leave it open for simulation"), which let any
 * caller flip an order to SHIPPED/DELIVERED and confuse buyers/sellers
 * + pollute the audit trail. Gate behind:
 *   - INTERNAL_SERVICE_KEY header (real callers integrate via reverse-proxy
 *     that injects this header), OR
 *   - admin JWT (manual override during demo / debugging).
 * If INTERNAL_SERVICE_KEY isn't configured, the dev convenience path is
 * still available behind admin auth — never blanket-public.
 */
function requireWebhookAuth(req: Request, res: Response, next: NextFunction) {
  const internalKey = req.headers['x-internal-service-key'] as string | undefined;
  const expected = process.env.INTERNAL_SERVICE_KEY;
  if (expected && internalKey && internalKey === expected) return next();

  return authenticate(req as any, res, (err?: any) => {
    if (err) return next(err);
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden — webhook requires internal service key or admin' });
    }
    next();
  });
}

router.post('/webhook/logistics', requireWebhookAuth, handleLogisticsWebhook);

export default router;
