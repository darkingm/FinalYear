import { Router } from 'express';
import { 
  generateQuote, 
  submitTransaction, 
  getPaymentStatus,
  verifyTransaction 
} from './crypto-payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { 
  generateQuoteSchema, 
  submitTransactionSchema, 
  getPaymentStatusSchema, 
  verifyTransactionSchema 
} from '../validation';

const router = Router();

router.post('/quote', authenticate, validateRequest(generateQuoteSchema), generateQuote);
router.post('/submit', authenticate, validateRequest(submitTransactionSchema), submitTransaction);
router.get('/status/:orderId', authenticate, validateRequest(getPaymentStatusSchema), getPaymentStatus);
router.post('/verify/:txHash', authenticate, validateRequest(verifyTransactionSchema), verifyTransaction);

export default router;
