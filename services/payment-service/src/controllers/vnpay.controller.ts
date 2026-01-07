import { Request, Response } from 'express';
import vnpayService from '../services/vnpay.service';
import Payment, { PaymentMethod, PaymentStatus } from '../models/Payment.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class VNPayController {
  /**
   * Create VNPay payment URL
   */
  static async createPaymentUrl(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { amount, orderId, orderDescription, orderType } = req.body;

      if (!amount || !orderId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: amount, orderId',
        });
      }

      // Convert USD to VND (approximate rate, should use real-time rate)
      const vndAmount = Math.round(amount * 25000); // 1 USD = 25000 VND (approximate)

      // Create payment record
      const payment = await Payment.create({
        userId,
        orderId,
        amount: vndAmount / 25000, // Store in USD
        currency: 'VND',
        paymentMethod: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        vnpayTxnRef: orderId,
        metadata: {
          vndAmount,
          orderDescription,
          orderType,
        },
      });

      // Create payment URL
      const paymentUrl = vnpayService.createPaymentUrl({
        amount: vndAmount,
        orderId: payment.id, // Use payment ID as transaction reference
        orderDescription: orderDescription || `Payment for order ${orderId}`,
        orderType: orderType || 'other',
        userId,
      });

      logger.info('VNPay payment URL created:', {
        paymentId: payment.id,
        orderId,
        amount: vndAmount,
      });

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          paymentUrl,
          amount: vndAmount,
          currency: 'VND',
        },
      });
    } catch (error: any) {
      logger.error('Create VNPay payment URL error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment URL',
        details: error.message,
      });
    }
  }

  /**
   * Handle VNPay return URL (user redirected back)
   */
  static async handleReturn(req: Request, res: Response) {
    try {
      const queryParams = req.query as Record<string, string>;
      const verification = vnpayService.verifyPaymentCallback(queryParams);

      // Find payment by order ID
      const payment = await Payment.findOne({
        where: { id: verification.orderId },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      // Update payment status
      if (verification.isValid && verification.responseCode === '00') {
        payment.status = PaymentStatus.COMPLETED;
        payment.vnpayTransactionId = verification.transactionId;
        await payment.save();

        // Publish event
        await publishEvent('payment.completed', {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: 'VNPAY',
        });

        logger.info('VNPay payment completed:', {
          paymentId: payment.id,
          transactionId: verification.transactionId,
        });
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.errorMessage = verification.message;
        await payment.save();

        logger.warn('VNPay payment failed:', {
          paymentId: payment.id,
          responseCode: verification.responseCode,
          message: verification.message,
        });
      }

      // Redirect to frontend with result
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/vnpay/result?paymentId=${payment.id}&status=${payment.status}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('VNPay return handler error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process return',
      });
    }
  }

  /**
   * Handle VNPay IPN (Instant Payment Notification)
   */
  static async handleIPN(req: Request, res: Response) {
    try {
      const queryParams = req.query as Record<string, string>;
      const verification = vnpayService.verifyPaymentCallback(queryParams);

      // Find payment
      const payment = await Payment.findOne({
        where: { id: verification.orderId },
      });

      if (!payment) {
        return res.status(404).json({
          RspCode: '01',
          Message: 'Payment not found',
        });
      }

      // Update payment status
      if (verification.isValid && verification.responseCode === '00') {
        if (payment.status !== PaymentStatus.COMPLETED) {
          payment.status = PaymentStatus.COMPLETED;
          payment.vnpayTransactionId = verification.transactionId;
          await payment.save();

          // Publish event
          await publishEvent('payment.completed', {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: 'VNPAY',
          });

          logger.info('VNPay IPN: Payment completed', {
            paymentId: payment.id,
            transactionId: verification.transactionId,
          });
        }

        return res.json({
          RspCode: '00',
          Message: 'Success',
        });
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.errorMessage = verification.message;
        await payment.save();

        return res.json({
          RspCode: '00',
          Message: 'Failed',
        });
      }
    } catch (error: any) {
      logger.error('VNPay IPN handler error:', error);
      return res.status(500).json({
        RspCode: '99',
        Message: 'Error',
      });
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findByPk(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.vnpayTransactionId,
        },
      });
    } catch (error: any) {
      logger.error('Get VNPay payment status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment status',
      });
    }
  }
}

