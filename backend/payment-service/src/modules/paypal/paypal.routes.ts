import { Router } from 'express';
import { createOrder, capturePayment, handleWebhook } from './paypal.controller';

const router = Router();

router.post('/create-order', createOrder);
router.post('/capture', capturePayment);
router.post('/webhook', handleWebhook);

export default router;
