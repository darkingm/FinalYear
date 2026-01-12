import express from 'express';
import { body } from 'express-validator';
import { PaymentController } from '../controllers/payment.controller';
import { VNPayController } from '../controllers/vnpay.controller';
import { PayPalController } from '../controllers/paypal.controller';
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

// Process coin payment
router.post(
  '/coin',
  [
    body('orderId').isString().withMessage('Order ID is required'),
    body('coinId').isString().withMessage('Coin ID is required'),
    body('coinSymbol').isString().withMessage('Coin symbol is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    validate,
  ],
  PaymentController.processCoinPayment
);

// VNPay routes
router.post(
  '/vnpay/create',
  [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('orderId').isString().withMessage('Order ID is required'),
    body('orderDescription').optional().isString(),
    validate,
  ],
  VNPayController.createPaymentUrl
);

// VNPay return URL (no auth required, verified by hash)
router.get('/vnpay/return', VNPayController.handleReturn);

// VNPay IPN (no auth required, verified by hash)
router.get('/vnpay/ipn', VNPayController.handleIPN);

// Get VNPay payment status
router.get('/vnpay/:paymentId/status', VNPayController.getPaymentStatus);

// PayPal routes
router.post(
  '/paypal/create',
  [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('orderId').isString().withMessage('Order ID is required'),
    body('description').optional().isString(),
    validate,
  ],
  PayPalController.createPayment
);

router.post('/paypal/capture/:orderId', PayPalController.capturePayment);

// PayPal webhook (no auth required, verified by signature)
router.post('/paypal/webhook', PayPalController.webhook);

// Get payment
router.get('/:id', PaymentController.getPayment);

// Get user's payments
router.get('/', PaymentController.getUserPayments);

export default router;

