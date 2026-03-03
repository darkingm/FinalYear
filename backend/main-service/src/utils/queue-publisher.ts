import { publishEvent } from '../config/rabbitmq';
import { logger } from './logger';

export async function publishOrderCreated(payload: {
  order_id: number;
  buyer_id: number;
  seller_id: number;
  product_id: number;
  price_usd: number;
  timestamp: number;
}) {
  await publishEvent('order.created', payload);
  logger.debug('Published order.created', payload);
}

export async function publishOrderCancelled(payload: {
  order_id: number;
  timestamp: number;
}) {
  await publishEvent('order.cancelled', payload);
  logger.debug('Published order.cancelled', payload);
}

export { publishEvent } from '../config/rabbitmq';
