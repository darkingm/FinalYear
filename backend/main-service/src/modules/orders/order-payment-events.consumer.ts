import { subscribeToEvents } from '../../config/rabbitmq';
import { logger } from '../../utils/logger';
import {
  OrderPaymentProjectionService,
  type OrderPaymentEvent,
} from './order-payment-projection.service';

type SubscribeFn = (
  topics: string[],
  callback: (payload: OrderPaymentEvent) => Promise<void> | void,
  options?: {
    queueName?: string;
    durable?: boolean;
    prefetch?: number;
    requeueOnError?: boolean;
  }
) => Promise<void>;

interface OrderPaymentEventsConsumerDeps {
  subscribe?: SubscribeFn;
  projectionService?: Pick<OrderPaymentProjectionService, 'applyEvent'>;
}

export const PAYMENT_EVENT_TOPICS = [
  'payment.submitted',
  'payment.confirming',
  'payment.confirmed',
  'payment.failed',
  'payment.expired',
  'payment.released',
  'payment.refunded',
];

export const PAYMENT_PROJECTION_QUEUE = 'main-service.payment-projection';

export class OrderPaymentEventsConsumer {
  private readonly subscribe: SubscribeFn;
  private readonly projectionService: Pick<OrderPaymentProjectionService, 'applyEvent'>;

  constructor({
    subscribe = subscribeToEvents,
    projectionService = new OrderPaymentProjectionService(),
  }: OrderPaymentEventsConsumerDeps = {}) {
    this.subscribe = subscribe;
    this.projectionService = projectionService;
  }

  async start() {
    await this.subscribe(
      PAYMENT_EVENT_TOPICS,
      async (payload) => {
        try {
          await this.projectionService.applyEvent(payload);
        } catch (error: any) {
          logger.error('Failed to apply payment event projection', {
            event_id: payload?.event_id,
            event_type: payload?.event_type,
            error: error.message,
          });
          throw error;
        }
      },
      {
        queueName: PAYMENT_PROJECTION_QUEUE,
        durable: true,
        prefetch: 10,
      }
    );
  }
}
