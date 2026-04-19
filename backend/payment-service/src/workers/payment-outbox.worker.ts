import { query } from '../config/database';
import { publishEvent } from '../config/rabbitmq';
import { logger } from '../utils/logger';

type PaymentQuery = (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
type PublishFn = (topic: string, data: any) => Promise<void>;

interface PaymentOutboxWorkerDeps {
  paymentQuery?: PaymentQuery;
  publish?: PublishFn;
  now?: () => Date;
  intervalMs?: number;
}

export class PaymentOutboxWorker {
  private readonly paymentQuery: PaymentQuery;
  private readonly publish: PublishFn;
  private readonly now: () => Date;
  private readonly intervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor({
    paymentQuery = query,
    publish = publishEvent,
    now = () => new Date(),
    intervalMs = 3000,
  }: PaymentOutboxWorkerDeps = {}) {
    this.paymentQuery = paymentQuery;
    this.publish = publish;
    this.now = now;
    this.intervalMs = intervalMs;
  }

  start() {
    logger.info('Starting payment outbox worker');
    void this.runOnce();
    this.intervalId = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  async runOnce() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.paymentQuery(
        `SELECT * FROM payment_outbox
         WHERE published_at IS NULL
         ORDER BY created_at ASC
         LIMIT 50`
      );

      for (const row of result.rows) {
        try {
          await this.publish(row.event_type, row.payload);
          await this.paymentQuery(
            `UPDATE payment_outbox
             SET published_at = $2,
                 last_error = NULL
             WHERE event_id = $1`,
            [row.event_id, this.now()]
          );
        } catch (error: any) {
          await this.paymentQuery(
            `UPDATE payment_outbox
             SET retry_count = retry_count + 1,
                 last_error = $1
             WHERE event_id = $2`,
            [error.message, row.event_id]
          );

          logger.warn('Payment outbox publish failed', {
            event_id: row.event_id,
            event_type: row.event_type,
            error: error.message,
          });
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
