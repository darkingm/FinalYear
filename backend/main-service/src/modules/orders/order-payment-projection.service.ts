import type { PoolClient } from 'pg';
import { getClient } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export interface OrderPaymentEvent {
  event_id: string;
  event_type: string;
  version: number;
  occurred_at: string;
  payment_id: number;
  order_id: number;
  session_id: string | null;
  tx_hash: string | null;
  chain_id: number | null;
  from_state: string | null;
  to_state: string;
  reason: string | null;
  metadata: Record<string, unknown>;
}

type TransactionClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

type WithTransaction = <T>(callback: (client: TransactionClient) => Promise<T>) => Promise<T>;

interface OrderPaymentProjectionServiceDeps {
  withTransaction?: WithTransaction;
  now?: () => Date;
}

async function defaultWithTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function projectOrderStatus(input: { currentStatus: string; eventType: string }) {
  const { currentStatus, eventType } = input;

  if (eventType === 'payment.submitted' || eventType === 'payment.confirming') {
    if (['UNPAID', 'TX_FAILED', 'TX_SUBMITTED'].includes(currentStatus)) {
      return 'TX_SUBMITTED';
    }
    return currentStatus;
  }

  if (eventType === 'payment.confirmed') {
    if (['UNPAID', 'TX_FAILED', 'TX_SUBMITTED', 'PAID'].includes(currentStatus)) {
      return 'PAID';
    }
    return currentStatus;
  }

  if (eventType === 'payment.failed' || eventType === 'payment.expired') {
    if (['UNPAID', 'TX_SUBMITTED', 'TX_FAILED'].includes(currentStatus)) {
      return 'TX_FAILED';
    }
    return currentStatus;
  }

  if (eventType === 'payment.released') {
    if (['PAID', 'ONCHAIN_CONFIRMED', 'COMPLETED'].includes(currentStatus)) {
      return 'COMPLETED';
    }
    return currentStatus;
  }

  if (eventType === 'payment.refunded') {
    if (['UNPAID', 'TX_SUBMITTED', 'TX_FAILED', 'PAID', 'COMPLETED', 'REFUNDED'].includes(currentStatus)) {
      return 'REFUNDED';
    }
    return currentStatus;
  }

  return currentStatus;
}

export class OrderPaymentProjectionService {
  private readonly withTransaction: WithTransaction;
  private readonly now: () => Date;

  constructor({
    withTransaction = defaultWithTransaction,
    now = () => new Date(),
  }: OrderPaymentProjectionServiceDeps = {}) {
    this.withTransaction = withTransaction;
    this.now = now;
  }

  async applyEvent(event: OrderPaymentEvent) {
    return this.withTransaction(async (client) => {
      const processed = await client.query(
        'SELECT event_id FROM processed_events WHERE event_id = $1 LIMIT 1',
        [event.event_id]
      );

      if (processed.rows[0]) {
        return { applied: false, reason: 'duplicate' };
      }

      const orderResult = await client.query(
        'SELECT order_id, status FROM orders WHERE order_id = $1 LIMIT 1',
        [event.order_id]
      );

      const order = orderResult.rows[0];
      if (!order) {
        throw new AppError('Order not found for payment projection', 404);
      }

      const nextStatus = projectOrderStatus({
        currentStatus: order.status,
        eventType: event.event_type,
      });

      if (nextStatus !== order.status) {
        await client.query(
          `UPDATE orders
           SET status = $2,
               tx_hash = COALESCE($3, tx_hash),
               payment_projection_updated_at = $4,
               payment_projection_version = payment_projection_version + 1,
               updated_at = $4
           WHERE order_id = $1`,
          [event.order_id, nextStatus, event.tx_hash, this.now()]
        );
      } else {
        await client.query(
          `UPDATE orders
           SET payment_projection_updated_at = $2,
               payment_projection_version = payment_projection_version + 1
           WHERE order_id = $1`,
          [event.order_id, this.now()]
        );
      }

      await client.query(
        `INSERT INTO processed_events (event_id, event_type, aggregate_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          event.event_id,
          event.event_type,
          String(event.order_id),
          JSON.stringify({
            payment_id: event.payment_id,
            tx_hash: event.tx_hash,
            occurred_at: event.occurred_at,
          }),
        ]
      );

      return { applied: true, status: nextStatus };
    });
  }
}
