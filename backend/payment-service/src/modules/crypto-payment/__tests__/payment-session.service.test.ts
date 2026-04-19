import {
  PaymentSessionService,
  type PaymentSessionRecord,
  type PaymentQuoteResolver,
} from '../payment-session.service';

describe('PaymentSessionService', () => {
  const now = new Date('2026-04-19T10:00:00.000Z');

  function buildSession(overrides: Partial<PaymentSessionRecord> = {}): PaymentSessionRecord {
    return {
      session_id: 'session-1',
      nonce: 'nonce-1',
      user_id: 7,
      order_id: 42,
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token: '75.000000',
      quote_snapshot: {
        token_symbol: 'USDT',
        chain_id: 31337,
        amount_token: 75,
        amount_wei: '75000000',
      },
      status: 'quoted',
      tx_hash: null,
      expires_at: new Date('2026-04-19T10:10:00.000Z'),
      used_at: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  it('creates a session bound to user, order, token, chain and amount', async () => {
    const paymentQuery = jest.fn().mockResolvedValueOnce({
      rows: [buildSession()],
    });
    const mainQuery = jest.fn().mockResolvedValueOnce({
      rows: [{ order_id: 42, buyer_id: 7, status: 'UNPAID' }],
    });
    const quoteResolver: jest.MockedFunction<PaymentQuoteResolver> = jest.fn().mockResolvedValue({
      order_id: 42,
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token: 75,
      amount_wei: '75000000',
      token_price: 1,
      escrow_contract: '0xescrow',
      expires_at: 1_776_590_400,
    });

    const service = new PaymentSessionService({
      paymentQuery,
      mainQuery,
      quoteResolver,
      now: () => now,
      sessionTtlMs: 10 * 60 * 1000,
    });

    const session = await service.createSession({
      userId: 7,
      orderId: 42,
      tokenSymbol: 'USDT',
      chainId: 31337,
    });

    expect(mainQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM orders'),
      [42]
    );
    expect(quoteResolver).toHaveBeenCalledWith({
      orderId: 42,
      tokenSymbol: 'USDT',
      preferredChainId: 31337,
      buyerWallet: undefined,
    });
    expect(paymentQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_sessions'),
      expect.arrayContaining([7, 42, 'USDT', 31337, 75, expect.any(String)])
    );
    expect(session.user_id).toBe(7);
    expect(session.order_id).toBe(42);
    expect(session.nonce).toBeDefined();
    expect(session.token_symbol).toBe('USDT');
    expect(session.chain_id).toBe(31337);
    expect(session.amount_token).toBe('75.000000');
  });

  it('rejects submit when nonce does not match the stored session', async () => {
    const paymentQuery = jest.fn().mockResolvedValueOnce({
      rows: [buildSession()],
    });

    const service = new PaymentSessionService({
      paymentQuery,
      mainQuery: jest.fn(),
      quoteResolver: jest.fn(),
      now: () => now,
    });

    await expect(
      service.assertUsableSession({
        sessionId: 'session-1',
        nonce: 'bad-nonce',
        userId: 7,
        orderId: 42,
        tokenSymbol: 'USDT',
        chainId: 31337,
        amountToken: 75,
      })
    ).rejects.toMatchObject({
      message: 'Invalid payment session',
      statusCode: 401,
    });
  });

  it('rejects replay after the session has already been consumed', async () => {
    const paymentQuery = jest.fn().mockResolvedValueOnce({
      rows: [buildSession({ status: 'submitted', tx_hash: '0xabc', used_at: now })],
    });

    const service = new PaymentSessionService({
      paymentQuery,
      mainQuery: jest.fn(),
      quoteResolver: jest.fn(),
      now: () => now,
    });

    await expect(
      service.assertUsableSession({
        sessionId: 'session-1',
        nonce: 'nonce-1',
        userId: 7,
        orderId: 42,
        tokenSymbol: 'USDT',
        chainId: 31337,
        amountToken: 75,
      })
    ).rejects.toMatchObject({
      message: 'Payment session has already been consumed',
      statusCode: 409,
    });
  });
});
