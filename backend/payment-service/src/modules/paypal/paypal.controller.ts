import { Request, Response, NextFunction } from 'express';
import { PayPalService } from './paypal.service';
import { logger } from '../../utils/logger';

const paypalService = new PayPalService();

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required',
      });
    }

    const result = await paypalService.createOrder(order_id);
    
    res.json({
      success: true,
      paypal_order_id: result.paypal_order_id,
      approval_url: result.approval_url,
    });
  } catch (error: any) {
    logger.error('Create PayPal order error:', error);
    next(error);
  }
}

export async function capturePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { paypal_order_id } = req.body;
    
    if (!paypal_order_id) {
      return res.status(400).json({
        success: false,
        message: 'paypal_order_id is required',
      });
    }

    const callerUserId = (req as any).user?.user_id;
    const result = await paypalService.capturePayment(paypal_order_id, callerUserId);
    
    res.json({
      success: true,
      status: result.status,
      capture_id: result.capture_id,
    });
  } catch (error: any) {
    logger.error('Capture PayPal payment error:', error);
    next(error);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const webhookData = req.body;
    const headers = req.headers;
    
    await paypalService.handleWebhook(webhookData, headers);
    
    res.status(200).send('OK');
  } catch (error: any) {
    logger.error('PayPal webhook error:', error);
    next(error);
  }
}
