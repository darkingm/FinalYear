import axios from 'axios';
import logger from '../utils/logger';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  returnUrl: string;
  cancelUrl: string;
}

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

class PayPalService {
  private config: PayPalConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox',
      returnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/payment/paypal/return',
      cancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/payment/paypal/cancel',
    };

    this.baseUrl =
      this.config.mode === 'sandbox'
        ? 'https://api.sandbox.paypal.com'
        : 'https://api.paypal.com';
  }

  /**
   * Get PayPal access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString('base64');

      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData: PayPalAccessToken = response.data;
      return tokenData.access_token;
    } catch (error: any) {
      logger.error('PayPal get access token error:', error);
      throw new Error('Failed to get PayPal access token');
    }
  }

  /**
   * Create PayPal order
   */
  async createOrder(params: {
    amount: number; // Amount in USD
    orderId: string;
    description: string;
    userId: string;
  }): Promise<PayPalOrder> {
    try {
      const accessToken = await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.orderId,
            description: params.description,
            amount: {
              currency_code: 'USD',
              value: params.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'TokenAsset',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${this.config.returnUrl}?orderId=${params.orderId}`,
          cancel_url: `${this.config.cancelUrl}?orderId=${params.orderId}`,
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('PayPal create order error:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to create PayPal order'
      );
    }
  }

  /**
   * Capture PayPal payment
   */
  async capturePayment(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('PayPal capture payment error:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to capture PayPal payment'
      );
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('PayPal get order error:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to get PayPal order'
      );
    }
  }

  /**
   * Verify webhook signature (for IPN)
   */
  async verifyWebhook(headers: any, body: string, webhookId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.verification_status === 'SUCCESS';
    } catch (error: any) {
      logger.error('PayPal verify webhook error:', error);
      return false;
    }
  }
}

export default new PayPalService();

