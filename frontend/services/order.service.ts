/**
 * Order Service – orchestrates order creation, payment flow, cancellation.
 * Pages call this service instead of talking to API/store directly.
 */
import { ordersApi } from '@/lib/api/orders';
import { paymentsApi } from '@/lib/api/payments';
import type { Order, CreateOrderPayload, CryptoQuote } from '@/types';
import { toast } from 'sonner';

class OrderService {
  /** Create an order and return it */
  async createOrder(payload: CreateOrderPayload): Promise<Order | null> {
    try {
      const res = await ordersApi.create(payload);
      const order: Order = res.data.order;
      toast.success('Tạo đơn hàng thành công');
      return order;
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Tạo đơn hàng thất bại';
      toast.error(msg);
      return null;
    }
  }

  /** Fetch single order */
  async getOrder(id: number): Promise<Order | null> {
    try {
      const res = await ordersApi.getById(id);
      return res.data.order;
    } catch {
      return null;
    }
  }

  /** Fetch order by internal UUID */
  async getOrderByInternalId(internalId: string): Promise<Order | null> {
    try {
      const res = await ordersApi.getByInternalId(internalId);
      return res.data.order;
    } catch {
      return null;
    }
  }

  /** List orders with optional pagination */
  async listOrders(params?: { page?: number; limit?: number }): Promise<{ orders: Order[]; total: number }> {
    try {
      const res = await ordersApi.list(params);
      return { orders: res.data.orders || [], total: res.data.total || 0 };
    } catch {
      return { orders: [], total: 0 };
    }
  }

  /** Get crypto quote for an order */
  async getCryptoQuote(orderId: number, tokenSymbol: string): Promise<CryptoQuote | null> {
    try {
      const res = await paymentsApi.crypto.quote(orderId, tokenSymbol);
      return res.data.quote;
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Lấy báo giá thất bại';
      // Check for seller wallet error → friendly message
      if (msg.includes('wallet_address') || msg.includes('Seller')) {
        toast.error('Người bán chưa liên kết ví crypto. Hãy thử PayPal.');
      } else {
        toast.error(msg);
      }
      throw new Error(msg);
    }
  }

  /** Create PayPal order and return approval URL */
  async createPayPalPayment(orderId: number): Promise<string | null> {
    try {
      const res = await paymentsApi.paypal.createOrder(orderId);
      return res.data.approval_url || null;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại');
      return null;
    }
  }

  /** Capture PayPal payment after buyer approves */
  async capturePayPal(paypalOrderId: string): Promise<boolean> {
    try {
      await paymentsApi.paypal.capture(paypalOrderId);
      toast.success('Thanh toán PayPal thành công');
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xác nhận PayPal thất bại');
      return false;
    }
  }

  /** Cancel an order */
  async cancelOrder(orderId: number): Promise<boolean> {
    try {
      await ordersApi.cancel(orderId);
      toast.success('Đã hủy đơn hàng');
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Hủy đơn thất bại');
      return false;
    }
  }
}

export const orderService = new OrderService();
