import { PAYMENT_EVENT_TOPICS, OrderPaymentEventsConsumer } from '../order-payment-events.consumer';

describe('OrderPaymentEventsConsumer', () => {
  it('subscribes to payment lifecycle topics and forwards them to projection service', async () => {
    const applyEvent = jest.fn().mockResolvedValue(undefined);
    const subscribe = jest.fn().mockResolvedValue(undefined);

    const consumer = new OrderPaymentEventsConsumer({
      subscribe,
      projectionService: { applyEvent },
    });

    await consumer.start();

    expect(subscribe).toHaveBeenCalledWith(
      expect.arrayContaining(PAYMENT_EVENT_TOPICS),
      expect.any(Function)
    );

    const callback = subscribe.mock.calls[0][1] as (payload: unknown) => Promise<void>;
    const payload = {
      event_id: 'evt-1',
      event_type: 'payment.confirmed',
      order_id: 42,
      session_id: 'session-1',
      tx_hash: '0xabc',
      chain_id: 31337,
      from_state: 'pending',
      to_state: 'confirmed',
      version: 1,
      occurred_at: '2026-04-19T14:30:00.000Z',
      payment_id: 77,
      reason: null,
      metadata: {},
    };

    await callback(payload);

    expect(applyEvent).toHaveBeenCalledWith(payload);
  });
});
