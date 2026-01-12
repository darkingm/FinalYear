import { Request, Response } from 'express';
import paypalService from '../services/paypal.service';
import Payment from '../models/Payment.model';
import logger from '../utils/logger';

export class PayPalController {
  /**
   * Create PayPal payment
   */
  static async createPayment(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { amount, orderId, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
        });
      }

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required',
        });
      }

      const order = await paypalService.createOrder({
        amount,
        orderId,
        description: description || `Payment for order ${orderId}`,
        userId,
      });

      // Save payment record
      await Payment.create({
        userId,
        orderId,
        amount,
        currency: 'USD',
        method: 'PAYPAL',
        status: 'PENDING',
        paymentId: order.id,
        metadata: {
          paypalOrderId: order.id,
          approvalUrl: order.links?.find((l) => l.rel === 'approve')?.href,
        },
      });

      res.json({
        success: true,
        data: {
          orderId: order.id,
          approvalUrl: order.links?.find((l) => l.rel === 'approve')?.href,
        },
      });
    } catch (error: any) {
      logger.error('PayPal create payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create PayPal payment',
      });
    }
  }

  /**
   * Capture PayPal payment
   */
  static async capturePayment(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { orderId } = req.params;

      const captureResult = await paypalService.capturePayment(orderId);

      // Update payment record
      const payment = await Payment.findOne({
        where: { paymentId: orderId, userId },
      });

      if (payment) {
        payment.status =
          captureResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
        payment.metadata = {
          ...payment.metadata,
          captureResult,
        };
        await payment.save();
      }

      res.json({
        success: captureResult.status === 'COMPLETED',
        data: captureResult,
      });
    } catch (error: any) {
      logger.error('PayPal capture payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to capture PayPal payment',
      });
    }
  }

  /**
   * PayPal webhook handler
   */
  static async webhook(req: Request, res: Response) {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
      const body = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = await paypalService.verifyWebhook(
        req.headers,
        body,
        webhookId
      );

      if (!isValid) {
        logger.warn('Invalid PayPal webhook signature');
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }

      const event = req.body;

      // Handle different webhook events
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const paymentId = event.resource?.supplementary_data?.related_ids?.order_id;
        
        if (paymentId) {
          const payment = await Payment.findOne({
            where: { paymentId },
          });

          if (payment) {
            payment.status = 'COMPLETED';
            payment.metadata = {
              ...payment.metadata,
              webhookEvent: event,
            };
            await payment.save();
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      logger.error('PayPal webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
      });
    }
  }
}

