import express from 'express';
import { body } from 'express-validator';
import { PaymentController } from '../controllers/payment.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Stripe webhook (no auth required, verified by signature)
router.post('/webhook', PaymentController.handleStripeWebhook);

// Create payment intent (requires auth)
router.post(
  '/intent',
  [
    body('orderId').optional().isString(),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency'),
    validate,
  ],
  PaymentController.createPaymentIntent
);

// Get payment
router.get('/:id', PaymentController.getPayment);

// Get user's payments
router.get('/', PaymentController.getUserPayments);

export default router;

