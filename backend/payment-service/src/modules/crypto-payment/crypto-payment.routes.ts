import { Router } from 'express';
import {
  createPaymentSession,
  getPaymentSessionQuote,
  submitPaymentSession,
  getPaymentSessionStatus,
  generateQuote,
  generateQuoteBatch,
  submitTransaction,
  getPaymentStatus,
  verifyTransaction,
  releaseFunds,
  refundPayment
} from './crypto-payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import {
  createPaymentSessionSchema,
  getPaymentSessionQuoteSchema,
  submitPaymentSessionSchema,
  getPaymentSessionStatusSchema,
  generateQuoteSchema,
  generateQuoteBatchSchema,
  submitTransactionSchema,
  getPaymentStatusSchema,
  verifyTransactionSchema,
  releaseFundsSchema,
  refundPaymentSchema
} from '../validation';
import { Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * authenticateOrInternalKey — accepts EITHER:
 *  1. A valid user JWT (admin calling from frontend)
 *  2. An X-Internal-Service-Key header (main-service auto-releasing after buyer confirms)
 *
 * This prevents the deadlock where main-service needs to trigger escrow release
 * but has no user token to forward.
 */
function authenticateOrInternalKey(req: Request, res: Response, next: NextFunction) {
  const internalKey = req.headers['x-internal-service-key'];
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;

  // SECURITY: Never use a hardcoded fallback key — fail closed if env var is missing
  if (internalKey && expectedKey && internalKey === expectedKey) {
    return next(); // trusted internal microservice call — skip JWT
  }
  // Fall through to standard JWT auth (admin action from browser)
  return authenticate(req as any, res, next);
}

router.post('/session', authenticate, validateRequest(createPaymentSessionSchema), createPaymentSession);
router.post('/session/:sessionId/quote', authenticate, validateRequest(getPaymentSessionQuoteSchema), getPaymentSessionQuote);
router.post('/session/:sessionId/submit', authenticate, validateRequest(submitPaymentSessionSchema), submitPaymentSession);
router.get('/session/:sessionId/status', authenticate, validateRequest(getPaymentSessionStatusSchema), getPaymentSessionStatus);

router.post('/quote', authenticate, validateRequest(generateQuoteSchema), generateQuote);
router.post('/quote-batch', authenticate, validateRequest(generateQuoteBatchSchema), generateQuoteBatch);
router.post('/submit', authenticate, validateRequest(submitTransactionSchema), submitTransaction);
router.get('/status/:orderId', authenticate, validateRequest(getPaymentStatusSchema), getPaymentStatus);
router.post('/verify/:txHash', authenticate, validateRequest(verifyTransactionSchema), verifyTransaction);

// Release: callable by admin (JWT) OR main-service (internal key after buyer confirms delivery)
router.post('/release', authenticateOrInternalKey, validateRequest(releaseFundsSchema), releaseFunds);

// Refund: admin only — triggered when admin resolves a dispute in buyer's favor
router.post('/refund', authenticate, validateRequest(refundPaymentSchema), refundPayment);

export default router;
