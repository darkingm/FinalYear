import { PaymentOpsHealthService } from '../payment-ops-health.service';

describe('PaymentOpsHealthService', () => {
  it('returns outbox counters plus queue depth when mq is connected', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        pending_count: '3',
        retrying_count: '1',
        locked_count: '2',
        stale_lock_count: '1',
        oldest_pending_at: new Date('2026-04-20T03:00:00.000Z'),
        oldest_pending_age_seconds: '90',
        last_published_at: new Date('2026-04-20T03:05:00.000Z'),
      }],
    });
    const checkQueue = jest.fn().mockResolvedValue({
      messageCount: 7,
      consumerCount: 1,
    });

    const service = new PaymentOpsHealthService({
      paymentQuery: query as any,
      getMqChannel: () => ({ ok: true, checkQueue }),
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.rabbitmq.status).toBe('connected');
    expect(snapshot.rabbitmq.projection_queue.message_count).toBe(7);
    expect(snapshot.rabbitmq.projection_queue.consumer_count).toBe(1);
    expect(snapshot.outbox.pending_count).toBe(3);
    expect(snapshot.outbox.retrying_count).toBe(1);
    expect(snapshot.outbox.locked_count).toBe(2);
    expect(snapshot.outbox.stale_lock_count).toBe(1);
    expect(snapshot.outbox.oldest_pending_at).toEqual(new Date('2026-04-20T03:00:00.000Z'));
    expect(snapshot.outbox.oldest_pending_age_seconds).toBe(90);
    expect(snapshot.outbox.last_published_at).toEqual(new Date('2026-04-20T03:05:00.000Z'));
  });

  it('degrades cleanly when mq is disconnected', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        pending_count: '0',
        retrying_count: '0',
        locked_count: '0',
        stale_lock_count: '0',
        oldest_pending_at: null,
        oldest_pending_age_seconds: null,
        last_published_at: null,
      }],
    });

    const service = new PaymentOpsHealthService({
      paymentQuery: query as any,
      getMqChannel: () => null,
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.rabbitmq.status).toBe('disconnected');
    expect(snapshot.rabbitmq.projection_queue.status).toBe('disconnected');
    expect(snapshot.outbox.pending_count).toBe(0);
    expect(snapshot.outbox.retrying_count).toBe(0);
  });
});
