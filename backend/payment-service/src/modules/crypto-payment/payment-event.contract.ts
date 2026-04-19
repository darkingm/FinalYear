import { randomUUID } from 'crypto';

export const PAYMENT_EVENT_VERSION = 1;

export const PAYMENT_EVENT_TYPES = {
  SUBMITTED: 'payment.submitted',
  CONFIRMING: 'payment.confirming',
  CONFIRMED: 'payment.confirmed',
  FAILED: 'payment.failed',
  RELEASED: 'payment.released',
  REFUNDED: 'payment.refunded',
} as const;

export type PaymentEventType = typeof PAYMENT_EVENT_TYPES[keyof typeof PAYMENT_EVENT_TYPES];

export interface BuildPaymentEventInput {
  eventType: PaymentEventType;
  paymentId: number;
  orderId: number;
  sessionId: string | null;
  txHash: string | null;
  chainId: number | null;
  fromState: string | null;
  toState: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentEventPayload {
  event_id: string;
  event_type: PaymentEventType;
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

export function buildPaymentEvent(input: BuildPaymentEventInput): PaymentEventPayload {
  return {
    event_id: randomUUID(),
    event_type: input.eventType,
    version: PAYMENT_EVENT_VERSION,
    occurred_at: new Date().toISOString(),
    payment_id: input.paymentId,
    order_id: input.orderId,
    session_id: input.sessionId,
    tx_hash: input.txHash,
    chain_id: input.chainId,
    from_state: input.fromState,
    to_state: input.toState,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  };
}
