import { randomUUID } from 'crypto';
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
  workerId?: string;
  lockTimeoutMs?: number;
}

export class PaymentOutboxWorker {
  private readonly paymentQuery: PaymentQuery;
  private readonly publish: PublishFn;
  private readonly now: () => Date;
  private readonly intervalMs: number;
  private readonly workerId: string;
  private readonly lockTimeoutMs: number;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor({
    paymentQuery = query,
    publish = publishEvent,
    now = () => new Date(),
    intervalMs = 3000,
    workerId = `payment-outbox:${process.pid}:${randomUUID()}`,
    lockTimeoutMs = 5 * 60 * 1000,
  }: PaymentOutboxWorkerDeps = {}) {
    this.paymentQuery = paymentQuery;
    this.publish = publish;
    this.now = now;
    this.intervalMs = intervalMs;
    this.workerId = workerId;
    this.lockTimeoutMs = lockTimeoutMs;
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
      const lockedAt = this.now();
      const staleBefore = new Date(lockedAt.getTime() - this.lockTimeoutMs);
      const result = await this.paymentQuery(
        `WITH candidates AS (
           SELECT event_id
           FROM payment_outbox
           WHERE published_at IS NULL
             AND (locked_at IS NULL OR locked_at < $2)
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 50
         )
         UPDATE payment_outbox AS outbox
         SET locked_at = $1,
             locked_by = $3
         FROM candidates
         WHERE outbox.event_id = candidates.event_id
         RETURNING outbox.*`,
        [lockedAt, staleBefore, this.workerId]
      );

      for (const row of result.rows) {
        try {
          await this.publish(row.event_type, row.payload);
          await this.paymentQuery(
            `UPDATE payment_outbox
             SET published_at = $2,
                 locked_at = NULL,
                 locked_by = NULL,
                 last_error = NULL
             WHERE event_id = $1
               AND locked_by = $3`,
            [row.event_id, this.now(), this.workerId]
          );
        } catch (error: any) {
          await this.paymentQuery(
            `UPDATE payment_outbox
             SET retry_count = retry_count + 1,
                 last_error = $1,
                 locked_at = NULL,
                 locked_by = NULL
             WHERE event_id = $2
               AND locked_by = $3`,
            [error.message, row.event_id, this.workerId]
          ).catch(() => {}); // best-effort — DB may be down

          logger.warn('Payment outbox publish failed', {
            event_id: row.event_id,
            event_type: row.event_type,
            error: error.message,
          });
        }
      }
    } catch (err: any) {
      // DB connection errors (timeout, reset, etc.) must NOT crash the process.
      // The worker will retry on the next interval tick.
      logger.error('Payment outbox worker cycle failed (will retry):', {
        error: err.message,
        code: err.code,
      });
    } finally {
      this.isRunning = false;
    }
  }
}
