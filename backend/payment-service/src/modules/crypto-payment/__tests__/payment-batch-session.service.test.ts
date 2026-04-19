import { PaymentBatchSessionService, type PaymentBatchSessionRecord } from '../payment-batch-session.service';

describe('PaymentBatchSessionService', () => {
  const now = new Date('2026-04-19T10:00:00.000Z');

  function buildSession(overrides: Partial<PaymentBatchSessionRecord> = {}): PaymentBatchSessionRecord {
    return {
      session_id: 'batch-session-1',
      nonce: 'e4b451e4-4acd-46d2-965c-28acb5a57ceb',
      user_id: 7,
      order_ids: [42, 43],
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token_total: '150.000000',
      quote_snapshot: {
        order_ids: [42, 43],
        token_symbol: 'USDT',
        chain_id: 31337,
        amount_token_total: 150,
        amount_wei_total: '150000000',
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

  it('creates a batch session bound to user, order set, token, chain and total amount', async () => {
    const paymentQuery = jest.fn().mockResolvedValueOnce({
      rows: [buildSession()],
    });
    const mainQuery = jest.fn().mockResolvedValueOnce({
      rows: [
        { order_id: 42, buyer_id: 7, status: 'UNPAID' },
        { order_id: 43, buyer_id: 7, status: 'UNPAID' },
      ],
    });
    const quoteResolver = jest.fn().mockResolvedValue({
      order_ids: [42, 43],
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token_total: 150,
      amount_wei_total: '150000000',
      token_price: 1,
      escrow_contract: '0xescrow',
      expires_at: 1_776_590_400,
    });

    const service = new PaymentBatchSessionService({
      paymentQuery,
      mainQuery,
      quoteResolver,
      now: () => now,
      sessionTtlMs: 10 * 60 * 1000,
    });

    const session = await service.createSession({
      userId: 7,
      orderIds: [42, 43],
      tokenSymbol: 'USDT',
      chainId: 31337,
    });

    expect(mainQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM orders'),
      [[42, 43]]
    );
    expect(quoteResolver).toHaveBeenCalledWith({
      orderIds: [42, 43],
      tokenSymbol: 'USDT',
      preferredChainId: 31337,
      buyerWallet: undefined,
    });
    expect(paymentQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_batch_sessions'),
      expect.arrayContaining([7, expect.any(String), 'USDT', 31337, 150, expect.any(String)])
    );
    expect(session.order_ids).toEqual([42, 43]);
    expect(session.amount_token_total).toBe('150.000000');
  });

  it('rejects replay after the batch session has already been consumed', async () => {
    const paymentQuery = jest.fn().mockResolvedValueOnce({
      rows: [buildSession({ status: 'submitted', tx_hash: '0xabc', used_at: now })],
    });

    const service = new PaymentBatchSessionService({
      paymentQuery,
      mainQuery: jest.fn(),
      quoteResolver: jest.fn(),
      now: () => now,
    });

    await expect(
      service.assertUsableSession({
        sessionId: 'batch-session-1',
        nonce: 'e4b451e4-4acd-46d2-965c-28acb5a57ceb',
        userId: 7,
        orderIds: [42, 43],
        tokenSymbol: 'USDT',
        chainId: 31337,
        amountTokenTotal: 150,
      })
    ).rejects.toMatchObject({
      message: 'Payment session has already been consumed',
      statusCode: 409,
    });
  });
});
