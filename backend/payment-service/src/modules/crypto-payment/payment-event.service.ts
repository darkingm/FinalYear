import type { PoolClient } from 'pg';
import { pool } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import {
  buildPaymentEvent,
  PAYMENT_EVENT_TYPES,
  type PaymentEventPayload,
  type PaymentEventType,
} from './payment-event.contract';

type TransactionClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

type WithTransaction = <T>(callback: (client: TransactionClient) => Promise<T>) => Promise<T>;

export interface PaymentRow {
  payment_id: number;
  order_id: number;
  tx_hash: string | null;
  chain_id: number | null;
  status: string;
  user_id: number | null;
  amount?: number | string | null;
  token_id?: number | null;
  from_address?: string | null;
  to_address?: string | null;
}

interface PaymentEventServiceDeps {
  withTransaction?: WithTransaction;
  now?: () => Date;
}

interface SubmitTransitionInput {
  orderId: number;
  sessionId: string | null;
  txHash: string;
  chainId: number;
  userId: number;
  amount: number;
  tokenId?: number | null;
  fromAddress?: string | null;
  toAddress?: string | null;
}

interface PaymentEventResult {
  payment: PaymentRow;
  outboxEvent: PaymentEventPayload;
}

const ALLOWED_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirming', 'confirmed', 'failed'],
  confirming: ['confirmed', 'failed'],
  confirmed: [],
  failed: [],
};

async function defaultWithTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
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

export class PaymentEventService {
  private readonly withTransaction: WithTransaction;
  private readonly now: () => Date;

  constructor({ withTransaction = defaultWithTransaction, now = () => new Date() }: PaymentEventServiceDeps = {}) {
    this.withTransaction = withTransaction;
    this.now = now;
  }

  async recordSubmitted(input: SubmitTransitionInput): Promise<PaymentEventResult> {
    return this.withTransaction(async (client) => {
      return this.recordSubmittedEntries(client, [input]).then((results) => results[0]);
    });
  }

  async recordSubmittedBatch(inputs: SubmitTransitionInput[]): Promise<PaymentEventResult[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.withTransaction(async (client) => this.recordSubmittedEntries(client, inputs));
  }

  async recordTransition(input: {
    orderId: number;
    paymentId: number;
    sessionId: string | null;
    txHash: string | null;
    chainId: number | null;
    eventType: PaymentEventType;
    toState: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentEventResult> {
    return this.withTransaction(async (client) => {
      const paymentResult = await client.query(
        'SELECT * FROM payments WHERE payment_id = $1 LIMIT 1',
        [input.paymentId]
      );
      const payment = paymentResult.rows[0] as PaymentRow | undefined;

      if (!payment) {
        throw new AppError('Payment not found for transition', 404);
      }

      if (payment.status === input.toState) {
        const existingEvent = await this.findOutboxEvent(
          client,
          this.buildAggregateId(input.orderId, input.txHash),
          input.eventType
        );

        if (existingEvent) {
          return {
            payment,
            outboxEvent: existingEvent,
          };
        }
      }

      this.assertAllowedTransition(payment.status, input.toState);

      const updatedPayment = await this.updatePaymentStatus(client, payment.payment_id, input.toState);
      const outboxEvent = buildPaymentEvent({
        eventType: input.eventType,
        paymentId: updatedPayment.payment_id,
        orderId: input.orderId,
        sessionId: input.sessionId,
        txHash: input.txHash,
        chainId: input.chainId,
        fromState: payment.status,
        toState: input.toState,
        reason: input.reason ?? null,
        metadata: input.metadata,
      });

      await client.query(
        `INSERT INTO payment_outbox (
           aggregate_type,
           aggregate_id,
           event_type,
           payload
         ) VALUES ($1, $2, $3, $4::jsonb)`,
        ['payment', this.buildAggregateId(input.orderId, input.txHash), input.eventType, JSON.stringify(outboxEvent)]
      );

      return {
        payment: updatedPayment,
        outboxEvent,
      };
    });
  }

  private async findPaymentByOrderAndHash(client: TransactionClient, orderId: number, txHash: string) {
    const result = await client.query(
      'SELECT * FROM payments WHERE order_id = $1 AND tx_hash = $2 LIMIT 1',
      [orderId, txHash]
    );

    return result.rows[0] as PaymentRow | undefined;
  }

  private async recordSubmittedEntries(
    client: TransactionClient,
    inputs: SubmitTransitionInput[]
  ): Promise<PaymentEventResult[]> {
    const results: PaymentEventResult[] = [];

    for (const input of inputs) {
      const existingPayment = await this.findPaymentByOrderAndHash(client, input.orderId, input.txHash);
      const aggregateId = this.buildAggregateId(input.orderId, input.txHash);

      if (existingPayment) {
        const existingEvent = await this.findOutboxEvent(client, aggregateId, PAYMENT_EVENT_TYPES.SUBMITTED);
        if (existingEvent) {
          results.push({
            payment: existingPayment,
            outboxEvent: existingEvent,
          });
          continue;
        }
      }

      const payment = existingPayment
        ? await this.updatePaymentStatus(client, existingPayment.payment_id, 'pending')
        : await this.insertSubmittedPayment(client, input);

      const outboxEvent = buildPaymentEvent({
        eventType: PAYMENT_EVENT_TYPES.SUBMITTED,
        paymentId: payment.payment_id,
        orderId: input.orderId,
        sessionId: input.sessionId,
        txHash: input.txHash,
        chainId: input.chainId,
        fromState: existingPayment?.status ?? null,
        toState: 'pending',
        metadata: {
          amount: input.amount,
          token_id: input.tokenId ?? null,
          submitted_at: this.now().toISOString(),
        },
      });

      await client.query(
        `INSERT INTO payment_outbox (
           aggregate_type,
           aggregate_id,
           event_type,
           payload
         ) VALUES ($1, $2, $3, $4::jsonb)`,
        ['payment', aggregateId, PAYMENT_EVENT_TYPES.SUBMITTED, JSON.stringify(outboxEvent)]
      );

      results.push({
        payment,
        outboxEvent,
      });
    }

    return results;
  }

  private async findOutboxEvent(client: TransactionClient, aggregateId: string, eventType: PaymentEventType) {
    const result = await client.query(
      'SELECT * FROM payment_outbox WHERE aggregate_type = $1 AND aggregate_id = $2 AND event_type = $3 LIMIT 1',
      ['payment', aggregateId, eventType]
    );

    return result.rows[0] as PaymentEventPayload | undefined;
  }

  private async insertSubmittedPayment(client: TransactionClient, input: SubmitTransitionInput): Promise<PaymentRow> {
    const result = await client.query(
      `INSERT INTO payments (
         order_id,
         tx_hash,
         chain_id,
         status,
         payment_type,
         amount,
         token_id,
         user_id,
         from_address,
         to_address
       )
       VALUES ($1, $2, $3, 'pending', 'crypto', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.orderId,
        input.txHash,
        input.chainId,
        input.amount,
        input.tokenId ?? null,
        input.userId,
        input.fromAddress ?? null,
        input.toAddress ?? null,
      ]
    );

    return result.rows[0] as PaymentRow;
  }

  private async updatePaymentStatus(client: TransactionClient, paymentId: number, nextStatus: string): Promise<PaymentRow> {
    const result = await client.query(
      `UPDATE payments
       SET status = $2,
           updated_at = $3
       WHERE payment_id = $1
       RETURNING *`,
      [paymentId, nextStatus, this.now()]
    );

    return result.rows[0] as PaymentRow;
  }

  private assertAllowedTransition(fromState: string, toState: string) {
    if (fromState === toState) {
      return;
    }

    const allowedStates = ALLOWED_PAYMENT_TRANSITIONS[fromState];
    if (!allowedStates || !allowedStates.includes(toState)) {
      throw new AppError(`Invalid payment transition: ${fromState} -> ${toState}`, 409);
    }
  }

  private buildAggregateId(orderId: number, txHash: string | null) {
    return `${orderId}:${txHash ?? 'no-tx'}`;
  }
}
