import { describe, expect, it } from '@jest/globals';
import { shapeEscrowOpsHealth } from '@/lib/admin/escrow-health';

describe('shapeEscrowOpsHealth', () => {
  it('maps raw health snapshot to UI cards', () => {
    const cards = shapeEscrowOpsHealth({
      payment_service: {
        rabbitmq: {
          status: 'connected',
          projection_queue: {
            status: 'healthy',
            name: 'main-service.payment-projection',
            message_count: 6,
            consumer_count: 1,
          },
        },
        outbox: {
          pending_count: 4,
          retrying_count: 1,
          locked_count: 2,
          stale_lock_count: 1,
          oldest_pending_at: '2026-04-20T04:00:00.000Z',
          oldest_pending_age_seconds: 180,
          last_published_at: '2026-04-20T04:05:00.000Z',
        },
      },
      main_service: {
        rabbitmq: { status: 'disconnected' },
        projection: {
          processed_24h: 12,
          last_processed_at: '2026-04-20T04:10:00.000Z',
          stale_projection_count: 2,
        },
      },
    });

    expect(cards).toHaveLength(6);
    expect(cards[0]).toEqual(expect.objectContaining({
      title: 'Payment RabbitMQ',
      tone: 'emerald',
      value: 'Connected',
    }));
    expect(cards[1]).toEqual(expect.objectContaining({
      title: 'Projection Queue',
      value: '6',
      detail: '1 consumer',
    }));
    expect(cards[2]).toEqual(expect.objectContaining({
      title: 'Outbox Pending',
      value: '4',
      detail: '1 retrying • 2 locked',
    }));
    expect(cards[3]).toEqual(expect.objectContaining({
      title: 'Outbox Lag',
      value: '3m',
      tone: 'amber',
    }));
    expect(cards[4]).toEqual(expect.objectContaining({
      title: 'Main RabbitMQ',
      tone: 'amber',
      value: 'Disconnected',
    }));
    expect(cards[5]).toEqual(expect.objectContaining({
      title: 'Stale Projections',
      tone: 'amber',
      value: '2',
    }));
  });
});
