import {
  OrderPaymentProjectionService,
  projectOrderStatus,
} from '../order-payment-projection.service';

describe('projectOrderStatus', () => {
  it('maps payment.confirmed to PAID', () => {
    const next = projectOrderStatus({
      currentStatus: 'TX_SUBMITTED',
      eventType: 'payment.confirmed',
    });

    expect(next).toBe('PAID');
  });

  it('does not regress a completed order when a late failed event arrives', () => {
    const next = projectOrderStatus({
      currentStatus: 'COMPLETED',
      eventType: 'payment.failed',
    });

    expect(next).toBe('COMPLETED');
  });

  it('maps payment.expired to TX_FAILED while keeping completed orders intact', () => {
    const submittedNext = projectOrderStatus({
      currentStatus: 'TX_SUBMITTED',
      eventType: 'payment.expired',
    });
    const completedNext = projectOrderStatus({
      currentStatus: 'COMPLETED',
      eventType: 'payment.expired',
    });

    expect(submittedNext).toBe('TX_FAILED');
    expect(completedNext).toBe('COMPLETED');
  });
});

describe('OrderPaymentProjectionService', () => {
  it('ignores an event already stored in processed_events', async () => {
    const client: { query: jest.Mock } = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ event_id: 'evt-1' }] }),
    };
    const withTransaction = async <T>(callback: (txClient: typeof client) => Promise<T>): Promise<T> => callback(client);

    const service = new OrderPaymentProjectionService({
      withTransaction,
      now: () => new Date('2026-04-19T14:00:00.000Z'),
    });

    await service.applyEvent({
      event_id: 'evt-1',
      event_type: 'payment.confirmed',
      order_id: 42,
      session_id: 'session-1',
      tx_hash: '0xabc',
      chain_id: 31337,
      from_state: 'pending',
      to_state: 'confirmed',
      version: 1,
      occurred_at: '2026-04-19T14:00:00.000Z',
      payment_id: 77,
      reason: null,
      metadata: {},
    });

    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
