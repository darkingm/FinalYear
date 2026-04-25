import { Router } from 'express';
import {
  createPaymentSession,
  createPaymentBatchSession,
  getPaymentSessionQuote,
  getPaymentBatchSessionQuote,
  submitPaymentSession,
  submitPaymentBatchSession,
  getPaymentSessionStatus,
  getPaymentBatchSessionStatus,
  getPaymentReconciliationCases,
  getPaymentOpsHealth,
  retryVerifyOrderPayment,
  expireStalePayments,
  generateQuote,
  getPaymentStatus,
  verifyTransaction,
  releaseFunds,
  refundPayment
} from './crypto-payment.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { invoiceLimiter, statusLimiter, strictLimiter } from '../../middleware/rate-limit';
import { validateRequest } from '../../middleware/validate.middleware';
import {
  createPaymentSessionSchema,
  createPaymentBatchSessionSchema,
  getPaymentSessionQuoteSchema,
  getPaymentBatchSessionQuoteSchema,
  submitPaymentSessionSchema,
  submitPaymentBatchSessionSchema,
  getPaymentSessionStatusSchema,
  getPaymentBatchSessionStatusSchema,
  getPaymentReconciliationCasesSchema,
  retryVerifyOrderPaymentSchema,
  expireStalePaymentsSchema,
  generateQuoteSchema,
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
  // Fall through to JWT auth + admin role check (not just any authenticated user)
  return authenticate(req as any, res, (err) => {
    if (err) return next(err);
    return authorize('admin')(req as any, res, next);
  });
}

router.post('/session', invoiceLimiter, authenticate, validateRequest(createPaymentSessionSchema), createPaymentSession);
router.post('/session-batch', invoiceLimiter, authenticate, validateRequest(createPaymentBatchSessionSchema), createPaymentBatchSession);
router.post('/session/:sessionId/quote', strictLimiter, authenticate, validateRequest(getPaymentSessionQuoteSchema), getPaymentSessionQuote);
router.post('/session-batch/:sessionId/quote', strictLimiter, authenticate, validateRequest(getPaymentBatchSessionQuoteSchema), getPaymentBatchSessionQuote);
router.post('/session/:sessionId/submit', strictLimiter, authenticate, validateRequest(submitPaymentSessionSchema), submitPaymentSession);
router.post('/session-batch/:sessionId/submit', strictLimiter, authenticate, validateRequest(submitPaymentBatchSessionSchema), submitPaymentBatchSession);
router.get('/session/:sessionId/status', statusLimiter, authenticate, validateRequest(getPaymentSessionStatusSchema), getPaymentSessionStatus);
router.get('/session-batch/:sessionId/status', statusLimiter, authenticate, validateRequest(getPaymentBatchSessionStatusSchema), getPaymentBatchSessionStatus);
router.get('/admin/reconciliation', strictLimiter, authenticateOrInternalKey, validateRequest(getPaymentReconciliationCasesSchema), getPaymentReconciliationCases);
router.get('/admin/ops-health', strictLimiter, authenticateOrInternalKey, getPaymentOpsHealth);
router.post('/admin/reconciliation/:orderId/retry-verify', strictLimiter, authenticateOrInternalKey, validateRequest(retryVerifyOrderPaymentSchema), retryVerifyOrderPayment);
router.post('/admin/reconciliation/expire-stale', strictLimiter, authenticateOrInternalKey, validateRequest(expireStalePaymentsSchema), expireStalePayments);

router.post('/quote', invoiceLimiter, authenticate, validateRequest(generateQuoteSchema), generateQuote);
router.get('/status/:orderId', statusLimiter, authenticate, validateRequest(getPaymentStatusSchema), getPaymentStatus);
router.post('/verify/:txHash', strictLimiter, authenticate, validateRequest(verifyTransactionSchema), verifyTransaction);

// Release: callable by admin (JWT) OR main-service (internal key after buyer confirms delivery)
router.post('/release', strictLimiter, authenticateOrInternalKey, validateRequest(releaseFundsSchema), releaseFunds);

// Refund: admin only — triggered when admin resolves a dispute in buyer's favor
router.post('/refund', strictLimiter, authenticateOrInternalKey, validateRequest(refundPaymentSchema), refundPayment);

export default router;
