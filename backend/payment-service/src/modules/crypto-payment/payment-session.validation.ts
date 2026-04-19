import { AppError } from '../../middleware/error-handler';

export interface GuardedPaymentSessionRecord {
  session_id: string;
  nonce: string;
  user_id: number;
  status: string;
  tx_hash: string | null;
  expires_at: Date | string;
  used_at: Date | string | null;
}

export interface GuardedPaymentPayloadSessionRecord extends GuardedPaymentSessionRecord {
  token_symbol: string;
  chain_id: number;
}

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

export function assertSessionOwnership(session: GuardedPaymentSessionRecord, userId: number) {
  if (session.user_id !== userId) {
    throw new AppError('Invalid payment session', 401);
  }
}

export function assertSessionNonce(session: GuardedPaymentSessionRecord, nonce: string) {
  if (!nonce || session.nonce !== nonce) {
    throw new AppError('Invalid payment session', 401);
  }
}

export function assertSessionNotExpired(session: GuardedPaymentSessionRecord, now: Date) {
  if (toDate(session.expires_at).getTime() <= now.getTime() || session.status === 'expired') {
    throw new AppError('Payment session has expired', 410);
  }
}

export function assertSessionNotConsumed(session: GuardedPaymentSessionRecord) {
  if (session.used_at || session.tx_hash || session.status === 'submitted') {
    throw new AppError('Payment session has already been consumed', 409);
  }
}

export function assertSessionActive(session: GuardedPaymentSessionRecord) {
  if (session.status === 'invalidated') {
    throw new AppError('Payment session is no longer active', 409);
  }

  if (!['session_created', 'quoted'].includes(session.status)) {
    throw new AppError('Invalid payment session state', 409);
  }
}

export function assertSessionPayloadMatches(
  session: GuardedPaymentPayloadSessionRecord & { order_id: number; amount_token: number | string },
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

export function assertBatchSessionPayloadMatches(
  session: GuardedPaymentPayloadSessionRecord & { order_ids: number[]; amount_token_total: number | string },
  payload: {
    orderIds: number[];
    tokenSymbol: string;
    chainId: number;
    amountTokenTotal: number | string;
  }
) {
  const expectedAmount = toNumber(session.amount_token_total);
  const actualAmount = toNumber(payload.amountTokenTotal);
  const normalizedTokenSymbol = payload.tokenSymbol.trim().toUpperCase();
  const expectedOrderIds = [...session.order_ids].sort((left, right) => left - right);
  const actualOrderIds = [...payload.orderIds].sort((left, right) => left - right);

  const sameOrderSet =
    expectedOrderIds.length === actualOrderIds.length
    && expectedOrderIds.every((orderId, index) => orderId === actualOrderIds[index]);

  if (
    !sameOrderSet ||
    session.chain_id !== payload.chainId ||
    session.token_symbol.toUpperCase() !== normalizedTokenSymbol ||
    Math.abs(expectedAmount - actualAmount) > SESSION_AMOUNT_EPSILON
  ) {
    throw new AppError('Invalid payment session', 401);
  }
}
