import {
  PAYMENT_EVENT_TYPES,
  buildPaymentEvent,
} from '../payment-event.contract';
import { PaymentEventService } from '../payment-event.service';

describe('payment event contract', () => {
  it('uses stable lifecycle event names', () => {
    expect(PAYMENT_EVENT_TYPES.SUBMITTED).toBe('payment.submitted');
    expect(PAYMENT_EVENT_TYPES.CONFIRMING).toBe('payment.confirming');
    expect(PAYMENT_EVENT_TYPES.CONFIRMED).toBe('payment.confirmed');
    expect(PAYMENT_EVENT_TYPES.FAILED).toBe('payment.failed');
    expect(PAYMENT_EVENT_TYPES.RELEASED).toBe('payment.released');
    expect(PAYMENT_EVENT_TYPES.REFUNDED).toBe('payment.refunded');
  });

  it('builds a versioned payload with required identifiers', () => {
    const event = buildPaymentEvent({
      eventType: PAYMENT_EVENT_TYPES.CONFIRMED,
      paymentId: 11,
      orderId: 42,
      sessionId: 'session-1',
      txHash: '0xabc',
      chainId: 31337,
      fromState: 'confirming',
      toState: 'confirmed',
      reason: null,
      metadata: { confirmations: 1 },
    });

    expect(event.event_id).toEqual(expect.any(String));
    expect(event.event_type).toBe('payment.confirmed');
    expect(event.version).toBe(1);
    expect(event.payment_id).toBe(11);
    expect(event.order_id).toBe(42);
    expect(event.session_id).toBe('session-1');
    expect(event.tx_hash).toBe('0xabc');
    expect(event.chain_id).toBe(31337);
    expect(event.from_state).toBe('confirming');
    expect(event.to_state).toBe('confirmed');
    expect(event.metadata).toEqual({ confirmations: 1 });
  });
});

describe('PaymentEventService', () => {
  it('writes payment state and outbox entry together for submit', async () => {
    const queries: Array<{ text: string; params?: unknown[] }> = [];
    const client: { query: jest.Mock } = {
      query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });

        if (text.includes('SELECT * FROM payments')) {
          return { rows: [] };
        }

        if (text.includes('INSERT INTO payments')) {
          return {
            rows: [{
              payment_id: 11,
              order_id: 42,
              tx_hash: '0xabc',
              chain_id: 31337,
              status: 'pending',
              user_id: 7,
            }],
          };
        }

        if (text.includes('SELECT * FROM payment_outbox')) {
          return { rows: [] };
        }

        if (text.includes('INSERT INTO payment_outbox')) {
          return { rows: [{ event_id: 'evt-1' }] };
        }

        return { rows: [] };
      }),
    };
    const withTransaction = async <T>(callback: (txClient: typeof client) => Promise<T>): Promise<T> => callback(client);

    const service = new PaymentEventService({
      withTransaction,
      now: () => new Date('2026-04-19T12:00:00.000Z'),
    });

    const result = await service.recordSubmitted({
      orderId: 42,
      sessionId: 'session-1',
      txHash: '0xabc',
      chainId: 31337,
      userId: 7,
      amount: 75,
      tokenId: 9,
      fromAddress: '0xbuyer',
      toAddress: '0xescrow',
    });

    expect(result.payment.status).toBe('pending');
    expect(result.outboxEvent.event_type).toBe(PAYMENT_EVENT_TYPES.SUBMITTED);
    expect(queries.some((entry) => entry.text.includes('INSERT INTO payments'))).toBe(true);
    expect(queries.some((entry) => entry.text.includes('INSERT INTO payment_outbox'))).toBe(true);
  });

  it('does not create duplicate submit events for the same tx hash', async () => {
    const client: { query: jest.Mock } = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            payment_id: 11,
            order_id: 42,
            tx_hash: '0xabc',
            chain_id: 31337,
            status: 'pending',
            user_id: 7,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            event_id: 'evt-1',
            event_type: PAYMENT_EVENT_TYPES.SUBMITTED,
            payload: { tx_hash: '0xabc' },
          }],
        }),
    };
    const withTransaction = async <T>(callback: (txClient: typeof client) => Promise<T>): Promise<T> => callback(client);

    const service = new PaymentEventService({
      withTransaction,
      now: () => new Date('2026-04-19T12:00:00.000Z'),
    });

    const result = await service.recordSubmitted({
      orderId: 42,
      sessionId: 'session-1',
      txHash: '0xabc',
      chainId: 31337,
      userId: 7,
      amount: 75,
      tokenId: 9,
      fromAddress: '0xbuyer',
      toAddress: '0xescrow',
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(result.outboxEvent.event_id).toBe('evt-1');
  });

  it('writes one payment row and one outbox event per order for batch submit', async () => {
    const queries: Array<{ text: string; params?: unknown[] }> = [];
    let paymentId = 10;
    const client: { query: jest.Mock } = {
      query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });

        if (text.includes('SELECT * FROM payments WHERE order_id')) {
          return { rows: [] };
        }

        if (text.includes('INSERT INTO payments')) {
          paymentId += 1;
          return {
            rows: [{
              payment_id: paymentId,
              order_id: params?.[0],
              tx_hash: params?.[1],
              chain_id: params?.[2],
              status: 'pending',
              user_id: params?.[5],
            }],
          };
        }

        if (text.includes('INSERT INTO payment_outbox')) {
          return { rows: [{ event_id: `evt-${paymentId}` }] };
        }

        return { rows: [] };
      }),
    };
    const withTransaction = async <T>(callback: (txClient: typeof client) => Promise<T>): Promise<T> => callback(client);

    const service = new PaymentEventService({
      withTransaction,
      now: () => new Date('2026-04-19T12:00:00.000Z'),
    });

    const result = await service.recordSubmittedBatch([
      {
        orderId: 42,
        sessionId: 'batch-session-1',
        txHash: '0xabc',
        chainId: 31337,
        userId: 7,
        amount: 75,
        tokenId: 9,
        fromAddress: '0xbuyer',
        toAddress: '0xescrow',
      },
      {
        orderId: 43,
        sessionId: 'batch-session-1',
        txHash: '0xabc',
        chainId: 31337,
        userId: 7,
        amount: 75,
        tokenId: 9,
        fromAddress: '0xbuyer',
        toAddress: '0xescrow',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.payment.order_id)).toEqual([42, 43]);
    expect(result.every((entry) => entry.outboxEvent.event_type === PAYMENT_EVENT_TYPES.SUBMITTED)).toBe(true);
    expect(queries.filter((entry) => entry.text.includes('INSERT INTO payments'))).toHaveLength(2);
    expect(queries.filter((entry) => entry.text.includes('INSERT INTO payment_outbox'))).toHaveLength(2);
  });
});
