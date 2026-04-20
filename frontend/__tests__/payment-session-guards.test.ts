import { describe, expect, it } from '@jest/globals';
import {
  canCreateFreshPaymentSession,
  hasSubmittedPaymentInFlight,
} from '@/lib/payments/payment-session-guards';

describe('payment session guards', () => {
  it('only allows creating a fresh session for unpaid and failed orders', () => {
    expect(canCreateFreshPaymentSession('UNPAID')).toBe(true);
    expect(canCreateFreshPaymentSession('TX_FAILED')).toBe(true);
    expect(canCreateFreshPaymentSession('TX_SUBMITTED')).toBe(false);
    expect(canCreateFreshPaymentSession('PAID')).toBe(false);
  });

  it('detects orders that already have an on-chain payment in flight or settled', () => {
    expect(hasSubmittedPaymentInFlight('TX_SUBMITTED')).toBe(true);
    expect(hasSubmittedPaymentInFlight('ONCHAIN_PENDING')).toBe(true);
    expect(hasSubmittedPaymentInFlight('ONCHAIN_CONFIRMED')).toBe(true);
    expect(hasSubmittedPaymentInFlight('PAID')).toBe(true);
    expect(hasSubmittedPaymentInFlight('UNPAID')).toBe(false);
  });
});
