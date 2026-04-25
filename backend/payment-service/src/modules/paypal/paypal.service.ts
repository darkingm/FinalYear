import paypal from '@paypal/checkout-server-sdk';
import { query, mainQuery } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import 'dotenv/config';
import axios from 'axios';

export class PayPalService {
  private _client: paypal.core.PayPalHttpClient | null = null;

  /** Lazy-init PayPal client — only throws when actually used, not on startup */
  private get client(): paypal.core.PayPalHttpClient {
    if (this._client) return this._client;

    const clientId = (process.env.PAYPAL_CLIENT_ID ?? '').trim();
    const clientSecret = (process.env.PAYPAL_SECRET ?? '').trim();
    if (!clientId || !clientSecret) {
      throw new AppError('PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_SECRET missing)', 503);
    }
    const environment = process.env.PAYPAL_MODE === 'production'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

    this._client = new paypal.core.PayPalHttpClient(environment);
    logger.info('PayPal client initialized successfully');
    return this._client;
  }

  async createOrder(orderId: number) {
    // Get order details
    const orderResult = await mainQuery(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    if (order.status !== 'UNPAID') {
      throw new AppError('Order is not in UNPAID status', 400);
    }

    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.internal_order_id,
          amount: {
            currency_code: 'USD',
            value: Number(order.price_usd).toFixed(2),
          },
          description: `Order #${order.internal_order_id}`,
        },
      ],
      application_context: {
        brand_name: 'Crypto Marketplace',
        locale: 'en-US',
        landing_page: 'BILLING',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/orders/${order.internal_order_id}?success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/orders/${order.internal_order_id}?cancelled=true`,
      },
    });

    const response = await this.client.execute(request);
    const paypalOrderId = response.result.id;

    // Update order with PayPal order ID
    await mainQuery(
      `UPDATE orders 
       SET paypal_order_id = $1, status = 'TX_SUBMITTED', payment_method = 'paypal', updated_at = NOW()
       WHERE order_id = $2`,
      [paypalOrderId, orderId]
    );

    // Get approval URL
    const approvalUrl = response.result.links?.find((link: any) => link.rel === 'approve')?.href;

    logger.info('PayPal order created', { orderId, paypalOrderId });

    return {
      paypal_order_id: paypalOrderId,
      approval_url: approvalUrl,
    };
  }

  async capturePayment(paypalOrderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const response = await this.client.execute(request);
    
    if (response.result.status !== 'COMPLETED') {
      throw new AppError('PayPal payment not completed', 400);
    }

    const captureId = response.result.purchase_units[0].payments.captures[0].id;
    const referenceId = response.result.purchase_units[0].reference_id;

    // Get order by internal_order_id
    const orderResult = await mainQuery(
      'SELECT * FROM orders WHERE internal_order_id = $1',
      [referenceId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    // Update order
    await mainQuery(
      `UPDATE orders 
       SET paypal_capture_id = $1, status = 'PAID_PAYPAL', updated_at = NOW()
       WHERE order_id = $2`,
      [captureId, order.order_id]
    );

    // Create payment record
    await query(
      `INSERT INTO payments (order_id, tx_hash, chain_id, status, from_address, to_address)
       VALUES ($1, $2, 0, 'confirmed', 'paypal', 'platform')`,
      [order.order_id, `paypal-${captureId}`]
    );

    // Publish event
    await publishEvent('payment.validated', {
      order_id: order.order_id,
      payment_method: 'paypal',
      paypal_capture_id: captureId,
      timestamp: Date.now(),
    });

    logger.info('PayPal payment captured', { orderId: order.order_id, captureId });

    return {
      status: 'COMPLETED',
      capture_id: captureId,
      order_id: order.order_id,
    };
  }

  async handleWebhook(webhookData: any, headers: any) {
    const eventType = webhookData.event_type;
    
    logger.info('PayPal webhook received', { eventType });

    // Verify webhook signature
    const isValid = await this.verifyWebhookSignature(webhookData, headers);
    if (!isValid) {
      logger.error('Invalid PayPal webhook signature', { eventType });
      throw new AppError('Invalid webhook signature', 400);
    }

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment completed
        const resource = webhookData.resource;
        await this.handlePaymentCompleted(resource);
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
        // Payment denied
        await this.handlePaymentDenied(webhookData.resource);
        break;
        
      case 'PAYMENT.CAPTURE.REFUNDED':
        // Payment refunded
        await this.handlePaymentRefunded(webhookData.resource);
        break;
        
      default:
        logger.info('Unhandled webhook event', { eventType });
    }
  }

  private async getAccessToken(): Promise<string> {
    const clientId = (process.env.PAYPAL_CLIENT_ID ?? '').trim();
    const clientSecret = (process.env.PAYPAL_SECRET ?? '').trim();
    if (!clientId || !clientSecret) {
      throw new AppError('PayPal credentials not configured', 503);
    }

    const isProd = process.env.PAYPAL_MODE === 'production';
    const baseUrl = isProd ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    try {
      const response = await axios.post(`${baseUrl}/v1/oauth2/token`, 'grant_type=client_credentials', {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to get PayPal access token', error);
      throw new AppError('Failed to get PayPal access token', 500);
    }
  }

  private async verifyWebhookSignature(webhookData: any, headers: any): Promise<boolean> {
    const webhookId = (process.env.PAYPAL_WEBHOOK_ID ?? '').trim();
    if (!webhookId) {
       if (process.env.PAYPAL_MODE === 'production') {
         logger.error('PAYPAL_WEBHOOK_ID is not configured — rejecting webhook in production');
         return false;
       }
       logger.warn('PAYPAL_WEBHOOK_ID not configured — skipping verify (dev/sandbox only)');
       return true;
    }

    const accessToken = await this.getAccessToken();
    const isProd = process.env.PAYPAL_MODE === 'production';
    const baseUrl = isProd ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    try {
      const response = await axios.post(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: webhookData
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.verification_status === 'SUCCESS';
    } catch (error) {
      logger.error('Failed to verify PayPal webhook signature', error);
      return false;
    }
  }

  private async handlePaymentCompleted(resource: any) {
    const captureId = resource.id;
    
    // Find order by capture ID
    const orderResult = await mainQuery(
      'SELECT * FROM orders WHERE paypal_capture_id = $1',
      [captureId]
    );

    if (orderResult.rows.length > 0) {
      const order = orderResult.rows[0];
      
      await mainQuery(
        `UPDATE orders SET status = 'PAID_PAYPAL', updated_at = NOW() WHERE order_id = $1`,
        [order.order_id]
      );

      await publishEvent('payment.validated', {
        order_id: order.order_id,
        payment_method: 'paypal',
        paypal_capture_id: captureId,
      });
    }
  }

  private async handlePaymentDenied(resource: any) {
    // Handle denied payment
    logger.warn('PayPal payment denied', resource);
  }

  private async handlePaymentRefunded(resource: any) {
    // Handle refunded payment
    logger.info('PayPal payment refunded', resource);
  }
}
