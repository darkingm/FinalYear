import { Request, Response } from 'express';
import Stripe from 'stripe';
import Payment, { PaymentMethod, PaymentStatus } from '../models/Payment.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export class PaymentController {
  // Create payment intent for credit card
  static async createPaymentIntent(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { orderId, amount, currency = 'usd' } = req.body;

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          userId,
          orderId,
        },
      });

      // Create payment record
      const payment = await Payment.create({
        userId,
        orderId,
        amount,
        currency: currency.toUpperCase(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.PENDING,
        stripePaymentIntentId: paymentIntent.id,
      });

      res.status(201).json({
        success: true,
        data: {
          paymentId: payment.id,
          clientSecret: paymentIntent.client_secret,
        },
      });
    } catch (error: any) {
      logger.error('Create payment intent error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment intent',
        details: error.message,
      });
    }
  }

  // Stripe webhook
  static async handleStripeWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentSuccess(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          await handlePaymentFailure(failedPayment);
          break;

        default:
          logger.info('Unhandled event type:', event.type);
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Webhook handler error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook handler failed',
      });
    }
  }

  // Get payment by ID
  static async getPayment(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const payment = await Payment.findOne({
        where: { id, userId },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment',
      });
    }
  }

  // Get user's payments
  static async getUserPayments(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const { count, rows } = await Payment.findAndCountAll({
        where: { userId },
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          payments: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user payments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payments',
      });
    }
  }
}

// Handle successful payment
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const payment = await Payment.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = PaymentStatus.COMPLETED;
      await payment.save();

      // Publish event
      await publishEvent('payment.completed', {
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
      });

      logger.info('Payment completed:', { paymentId: payment.id });
    }
  } catch (error) {
    logger.error('Handle payment success error:', error);
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const payment = await Payment.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      await payment.save();

      // Publish event
      await publishEvent('payment.failed', {
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        error: payment.errorMessage,
      });

      logger.error('Payment failed:', { paymentId: payment.id, error: payment.errorMessage });
    }
  } catch (error) {
    logger.error('Handle payment failure error:', error);
  }
}

