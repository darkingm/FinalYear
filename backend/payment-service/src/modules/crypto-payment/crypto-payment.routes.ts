import { Router } from 'express';
import {
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
  generateQuoteSchema,
  generateQuoteBatchSchema,
  submitTransactionSchema,
  getPaymentStatusSchema,
  verifyTransactionSchema,
  releaseFundsSchema,
  refundPaymentSchema
} from '../validation';

const router = Router();

router.post('/quote', authenticate, validateRequest(generateQuoteSchema), generateQuote);
router.post('/quote-batch', authenticate, validateRequest(generateQuoteBatchSchema), generateQuoteBatch);
router.post('/submit', authenticate, validateRequest(submitTransactionSchema), submitTransaction);
router.get('/status/:orderId', authenticate, validateRequest(getPaymentStatusSchema), getPaymentStatus);
router.post('/verify/:txHash', authenticate, validateRequest(verifyTransactionSchema), verifyTransaction);
router.post('/release', authenticate, validateRequest(releaseFundsSchema), releaseFunds);
router.post('/refund', authenticate, validateRequest(refundPaymentSchema), refundPayment);

export default router;
