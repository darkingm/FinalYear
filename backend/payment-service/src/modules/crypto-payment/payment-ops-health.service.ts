import { query as defaultQuery } from '../../config/database';
import { getChannel as defaultGetChannel } from '../../config/rabbitmq';

type PaymentQuery = typeof defaultQuery;
type GetMqChannel = typeof defaultGetChannel;

interface PaymentOpsHealthServiceDeps {
  paymentQuery?: PaymentQuery;
  getMqChannel?: GetMqChannel;
}

const PAYMENT_PROJECTION_QUEUE = process.env.PAYMENT_PROJECTION_QUEUE_NAME || 'main-service.payment-projection';

export class PaymentOpsHealthService {
  private readonly paymentQuery: PaymentQuery;
  private readonly getMqChannel: GetMqChannel;

  constructor({
    paymentQuery = defaultQuery,
    getMqChannel = defaultGetChannel,
  }: PaymentOpsHealthServiceDeps = {}) {
    this.paymentQuery = paymentQuery;
    this.getMqChannel = getMqChannel;
  }

  async getSnapshot() {
    const outboxResult = await this.paymentQuery(
      `SELECT
         COUNT(*) FILTER (WHERE published_at IS NULL) AS pending_count,
         COUNT(*) FILTER (WHERE published_at IS NULL AND retry_count > 0) AS retrying_count,
         COUNT(*) FILTER (WHERE published_at IS NULL AND locked_at IS NOT NULL) AS locked_count,
         COUNT(*) FILTER (
           WHERE published_at IS NULL
             AND locked_at IS NOT NULL
             AND locked_at < NOW() - INTERVAL '5 minutes'
         ) AS stale_lock_count,
         MIN(created_at) FILTER (WHERE published_at IS NULL) AS oldest_pending_at,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE published_at IS NULL))))::INT AS oldest_pending_age_seconds,
         MAX(published_at) AS last_published_at
       FROM payment_outbox`
    );

    const row = outboxResult.rows[0] || {};
    const mqChannel = this.getMqChannel();
    const projectionQueue = await this.getProjectionQueueHealth(mqChannel);

    return {
      rabbitmq: {
        status: mqChannel ? 'connected' : 'disconnected',
        projection_queue: projectionQueue,
      },
      outbox: {
        pending_count: Number(row.pending_count || 0),
        retrying_count: Number(row.retrying_count || 0),
        locked_count: Number(row.locked_count || 0),
        stale_lock_count: Number(row.stale_lock_count || 0),
        oldest_pending_at: row.oldest_pending_at || null,
        oldest_pending_age_seconds: row.oldest_pending_age_seconds !== null && row.oldest_pending_age_seconds !== undefined
          ? Number(row.oldest_pending_age_seconds)
          : null,
        last_published_at: row.last_published_at || null,
      },
    };
  }

  private async getProjectionQueueHealth(mqChannel: ReturnType<GetMqChannel>) {
    if (!mqChannel || typeof (mqChannel as any).checkQueue !== 'function') {
      return {
        status: mqChannel ? 'unknown' : 'disconnected',
        name: PAYMENT_PROJECTION_QUEUE,
        message_count: 0,
        consumer_count: 0,
      };
    }

    try {
      const queue = await (mqChannel as any).checkQueue(PAYMENT_PROJECTION_QUEUE);
      return {
        status: 'healthy',
        name: PAYMENT_PROJECTION_QUEUE,
        message_count: Number(queue?.messageCount || 0),
        consumer_count: Number(queue?.consumerCount || 0),
      };
    } catch {
      return {
        status: 'missing',
        name: PAYMENT_PROJECTION_QUEUE,
        message_count: 0,
        consumer_count: 0,
      };
    }
  }
}
