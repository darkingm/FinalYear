import { Router } from 'express';
import { 
  generateQuote, 
  submitTransaction, 
  getPaymentStatus,
  verifyTransaction 
} from './crypto-payment.controller';

const router = Router();

router.post('/quote', generateQuote);
router.post('/submit', submitTransaction);
router.get('/status/:orderId', getPaymentStatus);
router.post('/verify/:txHash', verifyTransaction);

export default router;
