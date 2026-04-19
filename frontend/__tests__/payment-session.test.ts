import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPost: any = jest.fn();
const mockGet: any = jest.fn();

jest.mock('@/lib/api/client', () => ({
  paymentClient: {
    post: mockPost,
    get: mockGet,
  },
}));

describe('payment session client helpers', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('creates a payment session before requesting a quote', async () => {
    mockPost.mockResolvedValue({ data: { session: { session_id: 'session-1' } } });

    const { createPaymentSession } = await import('@/lib/payments/payment-session');
    await createPaymentSession({
      orderId: 42,
      tokenSymbol: 'USDT',
      preferredChainId: 31337,
    });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session', {
      order_id: 42,
      token_symbol: 'USDT',
      preferred_chain_id: 31337,
      buyer_wallet: undefined,
    });
  });

  it('submits tx hash with session_id and nonce', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    const { submitPaymentSessionTransaction } = await import('@/lib/payments/payment-session');
    await submitPaymentSessionTransaction({
      sessionId: 'session-1',
      nonce: 'nonce-1',
      txHash: '0xabc',
    });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session/session-1/submit', {
      nonce: 'nonce-1',
      tx_hash: '0xabc',
    });
  });

  it('loads quote and status through the guarded session endpoints', async () => {
    mockPost.mockResolvedValue({ data: { quote: { amount_token: 75 } } });
    mockGet.mockResolvedValue({ data: { status: { payment_status: 'pending' } } });

    const {
      getPaymentSessionQuote,
      getPaymentSessionStatus,
    } = await import('@/lib/payments/payment-session');

    await getPaymentSessionQuote({ sessionId: 'session-1', nonce: 'nonce-1' });
    await getPaymentSessionStatus({ sessionId: 'session-1', nonce: 'nonce-1' });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session/session-1/quote', {
      nonce: 'nonce-1',
    });
    expect(mockGet).toHaveBeenCalledWith('/api/payments/crypto/session/session-1/status', {
      params: { nonce: 'nonce-1' },
    });
  });
});
