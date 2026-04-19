import { AppError } from '../../middleware/error-handler';
import type { PaymentSessionRecord } from './payment-session.service';

const SESSION_AMOUNT_EPSILON = 1e-9;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNumber(value: number | string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new AppError('Invalid payment session amount', 500);
  }
  return numeric;
}

export function assertSessionOwnership(session: PaymentSessionRecord, userId: number) {
  if (session.user_id !== userId) {
    throw new AppError('Invalid payment session', 401);
  }
}

export function assertSessionNonce(session: PaymentSessionRecord, nonce: string) {
  if (!nonce || session.nonce !== nonce) {
    throw new AppError('Invalid payment session', 401);
  }
}

export function assertSessionNotExpired(session: PaymentSessionRecord, now: Date) {
  if (toDate(session.expires_at).getTime() <= now.getTime() || session.status === 'expired') {
    throw new AppError('Payment session has expired', 410);
  }
}

export function assertSessionNotConsumed(session: PaymentSessionRecord) {
  if (session.used_at || session.tx_hash || session.status === 'submitted') {
    throw new AppError('Payment session has already been consumed', 409);
  }
}

export function assertSessionActive(session: PaymentSessionRecord) {
  if (session.status === 'invalidated') {
    throw new AppError('Payment session is no longer active', 409);
  }

  if (!['session_created', 'quoted'].includes(session.status)) {
    throw new AppError('Invalid payment session state', 409);
  }
}

export function assertSessionPayloadMatches(
  session: PaymentSessionRecord,
  payload: {
    orderId: number;
    tokenSymbol: string;
    chainId: number;
    amountToken: number | string;
  }
) {
  const expectedAmount = toNumber(session.amount_token);
  const actualAmount = toNumber(payload.amountToken);
  const normalizedTokenSymbol = payload.tokenSymbol.trim().toUpperCase();

  if (
    session.order_id !== payload.orderId ||
    session.chain_id !== payload.chainId ||
    session.token_symbol.toUpperCase() !== normalizedTokenSymbol ||
    Math.abs(expectedAmount - actualAmount) > SESSION_AMOUNT_EPSILON
  ) {
    throw new AppError('Invalid payment session', 401);
  }
}
