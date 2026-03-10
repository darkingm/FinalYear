import { Router } from 'express';
import { createOrder, capturePayment, handleWebhook } from './paypal.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { createPaypalOrderSchema, capturePaypalPaymentSchema } from '../validation';

const router = Router();

router.post('/create-order', authenticate, validateRequest(createPaypalOrderSchema), createOrder);
router.post('/capture', authenticate, validateRequest(capturePaypalPaymentSchema), capturePayment);
router.post('/webhook', handleWebhook);

export default router;
