import { PaymentOutboxWorker } from '../payment-outbox.worker';

describe('PaymentOutboxWorker', () => {
  it('publishes unpublished outbox rows and marks them as published', async () => {
    const paymentQuery = jest.fn()
      .mockResolvedValueOnce({
        rows: [{
          event_id: 'evt-1',
          event_type: 'payment.confirmed',
          payload: { order_id: 42 },
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const publish = jest.fn().mockResolvedValue(undefined);

    const worker = new PaymentOutboxWorker({
      paymentQuery,
      publish,
      now: () => new Date('2026-04-19T13:00:00.000Z'),
    });

    await worker.runOnce();

    expect(publish).toHaveBeenCalledWith('payment.confirmed', { order_id: 42 });
    expect(paymentQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payment_outbox'),
      expect.arrayContaining(['evt-1', expect.any(Date)])
    );
  });

  it('increments retry_count and stores last_error when publish fails', async () => {
    const paymentQuery = jest.fn()
      .mockResolvedValueOnce({
        rows: [{
          event_id: 'evt-1',
          event_type: 'payment.confirmed',
          payload: { order_id: 42 },
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const publish = jest.fn().mockRejectedValue(new Error('mq down'));

    const worker = new PaymentOutboxWorker({
      paymentQuery,
      publish,
      now: () => new Date('2026-04-19T13:00:00.000Z'),
    });

    await worker.runOnce();

    expect(paymentQuery).toHaveBeenCalledWith(
      expect.stringContaining('retry_count = retry_count + 1'),
      expect.arrayContaining(['mq down', 'evt-1'])
    );
  });

  it('claims unpublished outbox rows with row locking before publishing', async () => {
    const paymentQuery = jest.fn()
      .mockResolvedValueOnce({
        rows: [{
          event_id: 'evt-1',
          event_type: 'payment.confirmed',
          payload: { order_id: 42 },
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const publish = jest.fn().mockResolvedValue(undefined);

    const worker = new PaymentOutboxWorker({
      paymentQuery,
      publish,
      now: () => new Date('2026-04-20T02:10:00.000Z'),
    });

    await worker.runOnce();

    expect(String(paymentQuery.mock.calls[0][0])).toContain('FOR UPDATE SKIP LOCKED');
    expect(String(paymentQuery.mock.calls[0][0])).toContain('locked_at');
  });
});
