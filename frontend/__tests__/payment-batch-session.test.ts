import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPost: any = jest.fn();
const mockGet: any = jest.fn();

jest.mock('@/lib/api/client', () => ({
  paymentClient: {
    post: mockPost,
    get: mockGet,
  },
}));

describe('payment batch session client helpers', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('creates a batch payment session before requesting a batch quote', async () => {
    mockPost.mockResolvedValue({ data: { session: { session_id: 'batch-session-1' } } });

    const { createPaymentBatchSession } = await import('@/lib/payments/payment-batch-session');
    await createPaymentBatchSession({
      orderIds: [42, 43],
      tokenSymbol: 'USDT',
      preferredChainId: 31337,
    });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session-batch', {
      order_ids: [42, 43],
      token_symbol: 'USDT',
      preferred_chain_id: 31337,
      buyer_wallet: undefined,
    });
  });

  it('submits a batch tx hash with session_id and nonce', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    const { submitPaymentBatchSessionTransaction } = await import('@/lib/payments/payment-batch-session');
    await submitPaymentBatchSessionTransaction({
      sessionId: 'batch-session-1',
      nonce: 'nonce-1',
      txHash: '0xabc',
    });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session-batch/batch-session-1/submit', {
      nonce: 'nonce-1',
      tx_hash: '0xabc',
    });
  });

  it('loads quote and status through guarded batch session endpoints', async () => {
    mockPost.mockResolvedValue({ data: { quote: { amount_token_total: 150 } } });
    mockGet.mockResolvedValue({ data: { status: { overall_state: 'confirming' } } });

    const {
      getPaymentBatchSessionQuote,
      getPaymentBatchSessionStatus,
    } = await import('@/lib/payments/payment-batch-session');

    await getPaymentBatchSessionQuote({ sessionId: 'batch-session-1', nonce: 'nonce-1' });
    await getPaymentBatchSessionStatus({ sessionId: 'batch-session-1', nonce: 'nonce-1' });

    expect(mockPost).toHaveBeenCalledWith('/api/payments/crypto/session-batch/batch-session-1/quote', {
      nonce: 'nonce-1',
    });
    expect(mockGet).toHaveBeenCalledWith('/api/payments/crypto/session-batch/batch-session-1/status', {
      params: { nonce: 'nonce-1' },
    });
  });
});
