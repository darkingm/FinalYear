import { randomUUID } from 'crypto';
import { AppError } from '../../middleware/error-handler';
import {
  assertBatchSessionPayloadMatches,
  assertSessionActive,
  assertSessionNonce,
  assertSessionNotConsumed,
  assertSessionNotExpired,
  assertSessionOwnership,
} from './payment-session.validation';

type QueryResultLike<T> = Promise<{ rows: T[] }>;
type QueryLike = (text: string, params?: unknown[]) => QueryResultLike<any>;

export type PaymentBatchSessionStatus =
  | 'session_created'
  | 'quoted'
  | 'submitted'
  | 'expired'
  | 'invalidated';

export interface PaymentBatchSessionRecord {
  session_id: string;
  nonce: string;
  user_id: number;
  order_ids: number[];
  token_symbol: string;
  chain_id: number;
  amount_token_total: number | string;
  quote_snapshot: Record<string, unknown>;
  status: PaymentBatchSessionStatus;
  tx_hash: string | null;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PaymentBatchQuote {
  order_ids: number[];
  token_symbol: string;
  chain_id: number;
  amount_token_total: number;
  amount_wei_total: string;
  [key: string]: unknown;
}

export type PaymentBatchQuoteResolver = (input: {
  orderIds: number[];
  tokenSymbol: string;
  preferredChainId?: number;
  buyerWallet?: string;
}) => Promise<PaymentBatchQuote>;

interface PaymentBatchSessionServiceDeps {
  paymentQuery: QueryLike;
  mainQuery: QueryLike;
  quoteResolver: PaymentBatchQuoteResolver;
  now?: () => Date;
  sessionTtlMs?: number;
}

function normalizeOrderIds(orderIds: number[]) {
  return [...new Set(orderIds)].sort((left, right) => left - right);
}

export class PaymentBatchSessionService {
  private readonly paymentQuery: QueryLike;
  private readonly mainQuery: QueryLike;
  private readonly quoteResolver: PaymentBatchQuoteResolver;
  private readonly now: () => Date;
  private readonly sessionTtlMs: number;

  constructor({
    paymentQuery,
    mainQuery,
    quoteResolver,
    now = () => new Date(),
    sessionTtlMs = 10 * 60 * 1000,
  }: PaymentBatchSessionServiceDeps) {
    this.paymentQuery = paymentQuery;
    this.mainQuery = mainQuery;
    this.quoteResolver = quoteResolver;
    this.now = now;
    this.sessionTtlMs = sessionTtlMs;
  }

  async createSession(input: {
    userId: number;
    orderIds: number[];
    tokenSymbol: string;
    chainId?: number;
    buyerWallet?: string;
  }): Promise<PaymentBatchSessionRecord> {
    const normalizedOrderIds = normalizeOrderIds(input.orderIds);
    if (normalizedOrderIds.length === 0) {
      throw new AppError('At least one order is required', 400);
    }

    const orderResult = await this.mainQuery(
      `SELECT order_id, buyer_id, status
       FROM orders
       WHERE order_id = ANY($1::int[])`,
      [normalizedOrderIds]
    );

    if (orderResult.rows.length !== normalizedOrderIds.length) {
      throw new AppError('Some orders were not found', 404);
    }

    for (const order of orderResult.rows) {
      if (order.buyer_id !== input.userId) {
        throw new AppError('Cannot create payment session for these orders', 403);
      }

      if (!['UNPAID', 'TX_FAILED'].includes(order.status)) {
        throw new AppError(`Order ${order.order_id} is not payable`, 400);
      }
    }

    const quote = await this.quoteResolver({
      orderIds: normalizedOrderIds,
      tokenSymbol: input.tokenSymbol,
      preferredChainId: input.chainId,
      buyerWallet: input.buyerWallet,
    });

    const canonicalAmountToken = Number(quote.amount_token_total);
    if (!Number.isFinite(canonicalAmountToken) || canonicalAmountToken <= 0) {
      throw new AppError('Invalid batch payment quote amount', 500);
    }

    const nonce = randomUUID();
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);

    const insertResult = await this.paymentQuery(
      `INSERT INTO payment_batch_sessions (
         nonce,
         user_id,
         order_ids,
         token_symbol,
         chain_id,
         amount_token_total,
         quote_snapshot,
         status,
         expires_at
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, 'quoted', $8)
       RETURNING *`,
      [
        nonce,
        input.userId,
        JSON.stringify(normalizedOrderIds),
        quote.token_symbol,
        quote.chain_id,
        canonicalAmountToken,
        JSON.stringify(quote),
        expiresAt,
      ]
    );

    if (!insertResult.rows[0]) {
      throw new AppError('Failed to create batch payment session', 500);
    }

    return this.normalizeRecord(insertResult.rows[0]);
  }

  async getSessionById(sessionId: string): Promise<PaymentBatchSessionRecord> {
    const sessionResult = await this.paymentQuery(
      'SELECT * FROM payment_batch_sessions WHERE session_id = $1 LIMIT 1',
      [sessionId]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      throw new AppError('Invalid payment session', 401);
    }

    return this.normalizeRecord(session);
  }

  async getAccessibleSession(input: {
    sessionId: string;
    userId: number;
    nonce?: string;
  }): Promise<PaymentBatchSessionRecord> {
    const session = await this.getSessionById(input.sessionId);
    assertSessionOwnership(session, input.userId);

    if (input.nonce) {
      assertSessionNonce(session, input.nonce);
    }

    return session;
  }

  async assertUsableSession(input: {
    sessionId: string;
    nonce: string;
    userId: number;
    orderIds: number[];
    tokenSymbol: string;
    chainId: number;
    amountTokenTotal: number | string;
  }): Promise<PaymentBatchSessionRecord> {
    const session = await this.getSessionById(input.sessionId);

    assertSessionOwnership(session, input.userId);
    assertSessionNonce(session, input.nonce);
    assertSessionNotExpired(session, this.now());
    assertSessionNotConsumed(session);
    assertSessionActive(session);
    assertBatchSessionPayloadMatches(session, {
      orderIds: input.orderIds,
      tokenSymbol: input.tokenSymbol,
      chainId: input.chainId,
      amountTokenTotal: input.amountTokenTotal,
    });

    return session;
  }

  async getSessionQuote(input: {
    sessionId: string;
    userId: number;
    nonce: string;
  }): Promise<PaymentBatchQuote> {
    const session = await this.getAccessibleSession(input);
    assertSessionNotExpired(session, this.now());

    return session.quote_snapshot as PaymentBatchQuote;
  }

  async markSessionSubmitted(input: {
    sessionId: string;
    txHash: string;
  }): Promise<PaymentBatchSessionRecord> {
    const now = this.now();
    const updateResult = await this.paymentQuery(
      `UPDATE payment_batch_sessions
       SET status = 'submitted',
           tx_hash = $2,
           used_at = $3
       WHERE session_id = $1
         AND status IN ('session_created', 'quoted')
         AND used_at IS NULL
       RETURNING *`,
      [input.sessionId, input.txHash, now]
    );

    const session = updateResult.rows[0];
    if (session) {
      return this.normalizeRecord(session);
    }

    const existing = await this.getSessionById(input.sessionId);
    if (existing.tx_hash === input.txHash && existing.status === 'submitted') {
      return existing;
    }

    throw new AppError('Payment session has already been consumed', 409);
  }

  private normalizeRecord(record: any): PaymentBatchSessionRecord {
    return {
      ...record,
      order_ids: Array.isArray(record.order_ids)
        ? record.order_ids.map((value: unknown) => Number(value))
        : [],
    } as PaymentBatchSessionRecord;
  }
}
