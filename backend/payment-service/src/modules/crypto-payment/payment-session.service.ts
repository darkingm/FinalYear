import { randomUUID } from 'crypto';
import { AppError } from '../../middleware/error-handler';
import {
  assertSessionActive,
  assertSessionNonce,
  assertSessionNotConsumed,
  assertSessionNotExpired,
  assertSessionOwnership,
  assertSessionPayloadMatches,
} from './payment-session.validation';

type QueryResultLike<T> = Promise<{ rows: T[] }>;
type QueryLike = (text: string, params?: unknown[]) => QueryResultLike<any>;

export type PaymentSessionStatus =
  | 'session_created'
  | 'quoted'
  | 'submitted'
  | 'expired'
  | 'invalidated';

export interface PaymentSessionRecord {
  session_id: string;
  nonce: string;
  user_id: number;
  order_id: number;
  token_symbol: string;
  chain_id: number;
  amount_token: number | string;
  quote_snapshot: Record<string, unknown>;
  status: PaymentSessionStatus;
  tx_hash: string | null;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PaymentQuote {
  order_id: number;
  token_symbol: string;
  chain_id: number;
  amount_token: number;
  amount_wei: string;
  token_price?: number;
  escrow_contract?: string;
  expires_at?: number;
  [key: string]: unknown;
}

export type PaymentQuoteResolver = (input: {
  orderId: number;
  tokenSymbol: string;
  preferredChainId?: number;
  buyerWallet?: string;
}) => Promise<PaymentQuote>;

interface PaymentSessionServiceDeps {
  paymentQuery: QueryLike;
  mainQuery: QueryLike;
  quoteResolver: PaymentQuoteResolver;
  now?: () => Date;
  sessionTtlMs?: number;
}

export class PaymentSessionService {
  private readonly paymentQuery: QueryLike;
  private readonly mainQuery: QueryLike;
  private readonly quoteResolver: PaymentQuoteResolver;
  private readonly now: () => Date;
  private readonly sessionTtlMs: number;

  constructor({
    paymentQuery,
    mainQuery,
    quoteResolver,
    now = () => new Date(),
    sessionTtlMs = 10 * 60 * 1000,
  }: PaymentSessionServiceDeps) {
    this.paymentQuery = paymentQuery;
    this.mainQuery = mainQuery;
    this.quoteResolver = quoteResolver;
    this.now = now;
    this.sessionTtlMs = sessionTtlMs;
  }

  private canCreateFreshSession(orderStatus: string) {
    return ['UNPAID', 'TX_FAILED'].includes(orderStatus);
  }

  private hasSubmittedPaymentInFlight(orderStatus: string) {
    return ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED', 'PAID'].includes(orderStatus);
  }

  async createSession(input: {
    userId: number;
    orderId: number;
    tokenSymbol: string;
    chainId?: number;
    buyerWallet?: string;
  }): Promise<PaymentSessionRecord> {
    const orderResult = await this.mainQuery(
      'SELECT order_id, buyer_id, status FROM orders WHERE order_id = $1',
      [input.orderId]
    );

    const order = orderResult.rows[0];

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.buyer_id !== input.userId) {
      throw new AppError('Cannot create payment session for this order', 403);
    }

    if (this.hasSubmittedPaymentInFlight(order.status)) {
      throw new AppError('Payment already submitted for this order', 409);
    }

    if (!this.canCreateFreshSession(order.status)) {
      throw new AppError('Order is not payable', 400);
    }

    const quote = await this.quoteResolver({
      orderId: input.orderId,
      tokenSymbol: input.tokenSymbol,
      preferredChainId: input.chainId,
      buyerWallet: input.buyerWallet,
    });

    const canonicalAmountToken = Number(quote.amount_token);
    if (!Number.isFinite(canonicalAmountToken) || canonicalAmountToken <= 0) {
      throw new AppError('Invalid payment quote amount', 500);
    }

    const nonce = randomUUID();
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);

    const insertResult = await this.paymentQuery(
      `INSERT INTO payment_sessions (
         nonce,
         user_id,
         order_id,
         token_symbol,
         chain_id,
         amount_token,
         quote_snapshot,
         status,
         expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'quoted', $8)
       RETURNING *`,
      [
        nonce,
        input.userId,
        input.orderId,
        quote.token_symbol,
        quote.chain_id,
        canonicalAmountToken,
        JSON.stringify(quote),
        expiresAt,
      ]
    );

    if (!insertResult.rows[0]) {
      throw new AppError('Failed to create payment session', 500);
    }

    return insertResult.rows[0] as PaymentSessionRecord;
  }

  async getSessionById(sessionId: string): Promise<PaymentSessionRecord> {
    const sessionResult = await this.paymentQuery(
      'SELECT * FROM payment_sessions WHERE session_id = $1 LIMIT 1',
      [sessionId]
    );

    const session = sessionResult.rows[0] as PaymentSessionRecord | undefined;
    if (!session) {
      throw new AppError('Invalid payment session', 401);
    }

    return session;
  }

  async getAccessibleSession(input: {
    sessionId: string;
    userId: number;
    nonce?: string;
  }): Promise<PaymentSessionRecord> {
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
    orderId: number;
    tokenSymbol: string;
    chainId: number;
    amountToken: number | string;
  }): Promise<PaymentSessionRecord> {
    const session = await this.getSessionById(input.sessionId);

    assertSessionOwnership(session, input.userId);
    assertSessionNonce(session, input.nonce);
    assertSessionNotExpired(session, this.now());
    assertSessionNotConsumed(session);
    assertSessionActive(session);
    assertSessionPayloadMatches(session, {
      orderId: input.orderId,
      tokenSymbol: input.tokenSymbol,
      chainId: input.chainId,
      amountToken: input.amountToken,
    });

    return session;
  }

  async getSessionQuote(input: {
    sessionId: string;
    userId: number;
    nonce: string;
  }): Promise<PaymentQuote> {
    const session = await this.getAccessibleSession(input);
    assertSessionNotExpired(session, this.now());

    return session.quote_snapshot as PaymentQuote;
  }

  async markSessionSubmitted(input: {
    sessionId: string;
    txHash: string;
  }): Promise<PaymentSessionRecord> {
    const now = this.now();
    const updateResult = await this.paymentQuery(
      `UPDATE payment_sessions
       SET status = 'submitted',
           tx_hash = $2,
           used_at = $3
       WHERE session_id = $1
         AND status IN ('session_created', 'quoted')
         AND used_at IS NULL
       RETURNING *`,
      [input.sessionId, input.txHash, now]
    );

    const session = updateResult.rows[0] as PaymentSessionRecord | undefined;

    if (session) {
      return session;
    }

    const existing = await this.getSessionById(input.sessionId);
    if (existing.tx_hash === input.txHash && existing.status === 'submitted') {
      return existing;
    }

    throw new AppError('Payment session has already been consumed', 409);
  }
}
