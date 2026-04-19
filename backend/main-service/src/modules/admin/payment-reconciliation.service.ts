import axios from 'axios';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { projectOrderStatus } from '../orders/order-payment-projection.service';

export interface PaymentReconciliationCase {
  order_id: number;
  order_number: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  order_status: string;
  order_updated_at: string | Date | null;
  order_tx_hash: string | null;
  order_chain_id: number | null;
  order_amount_token: number | string | null;
  order_total_amount: number | string | null;
  payment_projection_updated_at: string | Date | null;
  payment_projection_version: number | null;
  payment_id: number | null;
  payment_status: string | null;
  payment_tx_hash: string | null;
  payment_chain_id: number | null;
  payment_confirmations: number | null;
  payment_required_confirmations: number | null;
  payment_updated_at: string | Date | null;
  has_issue: boolean;
  issue_code: string | null;
  issue_label: string | null;
  issue_detail: string | null;
}

interface PaymentReconciliationAdminServiceDeps {
  httpGet?: typeof axios.get;
  httpPost?: typeof axios.post;
  now?: () => Date;
}

function mapPaymentStatusToEventType(paymentStatus: string | null | undefined) {
  if (paymentStatus === 'pending') return 'payment.submitted';
  if (paymentStatus === 'confirming') return 'payment.confirming';
  if (paymentStatus === 'confirmed') return 'payment.confirmed';
  if (paymentStatus === 'failed') return 'payment.failed';
  return null;
}

export class PaymentReconciliationAdminService {
  private readonly httpGet: typeof axios.get;
  private readonly httpPost: typeof axios.post;
  private readonly now: () => Date;

  constructor({
    httpGet = axios.get,
    httpPost = axios.post,
    now = () => new Date(),
  }: PaymentReconciliationAdminServiceDeps = {}) {
    this.httpGet = httpGet;
    this.httpPost = httpPost;
    this.now = now;
  }

  async listCases(params: { limit?: number; problemsOnly?: boolean; orderId?: number } = {}) {
    const response = await this.httpGet<{ success: true; cases: PaymentReconciliationCase[] }>(
      `${this.getPaymentServiceUrl()}/api/payments/crypto/admin/reconciliation`,
      {
        headers: this.getInternalHeaders(),
        params: {
          limit: params.limit ?? 50,
          problems_only: params.problemsOnly === false ? 'false' : 'true',
          ...(params.orderId ? { order_id: params.orderId } : {}),
        },
        timeout: 15000,
      }
    );

    return response.data.cases;
  }

  async retryVerify(orderId: number) {
    const response = await this.httpPost(
      `${this.getPaymentServiceUrl()}/api/payments/crypto/admin/reconciliation/${orderId}/retry-verify`,
      {},
      {
        headers: this.getInternalHeaders(),
        timeout: 30000,
      }
    );

    return response.data;
  }

  async repairOrderState(orderId: number) {
    const [reconciliationCase] = await this.listCases({
      orderId,
      problemsOnly: false,
      limit: 1,
    });

    if (!reconciliationCase) {
      throw new AppError('Reconciliation case not found', 404);
    }

    const eventType = mapPaymentStatusToEventType(reconciliationCase.payment_status);
    if (!eventType) {
      throw new AppError('No repairable payment state found for this order', 400);
    }

    const nextStatus = projectOrderStatus({
      currentStatus: reconciliationCase.order_status,
      eventType,
    });

    const updateResult = await query(
      `UPDATE orders
       SET status = $2,
           tx_hash = COALESCE($3, tx_hash),
           payment_projection_updated_at = $4,
           payment_projection_version = payment_projection_version + 1,
           updated_at = $4
       WHERE order_id = $1
       RETURNING order_id, status, tx_hash, payment_projection_version, payment_projection_updated_at`,
      [
        orderId,
        nextStatus,
        reconciliationCase.payment_tx_hash,
        this.now(),
      ]
    );

    if (!updateResult.rows[0]) {
      throw new AppError('Order not found', 404);
    }

    return {
      applied: true,
      previous_status: reconciliationCase.order_status,
      next_status: nextStatus,
      order: updateResult.rows[0],
      source_payment_status: reconciliationCase.payment_status,
    };
  }

  private getPaymentServiceUrl() {
    return process.env.PAYMENT_SERVICE_URL || process.env.PAYMENT_API_URL || 'http://localhost:3002';
  }

  private getInternalHeaders() {
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    if (!internalKey) {
      throw new AppError('INTERNAL_SERVICE_KEY is not configured', 500);
    }

    return {
      'X-Internal-Service-Key': internalKey,
    };
  }
}
