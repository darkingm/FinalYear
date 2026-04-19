import amqp from 'amqplib';
import { logger } from '../utils/logger';
import 'dotenv/config';

let connection: any;
let channel: any;

export async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    // Declare exchanges
    await channel.assertExchange('marketplace', 'topic', { durable: true });

    logger.info('RabbitMQ connected successfully');
    return { connection, channel };
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    throw error;
  }
}

export async function publishEvent(topic: string, data: any) {
  try {
    const message = Buffer.from(JSON.stringify(data));
    channel.publish('marketplace', topic, message, { persistent: true });
    logger.debug(`Published event: ${topic}`, data);
  } catch (error) {
    logger.error(`Failed to publish event: ${topic}`, error);
    throw error;
  }
}

export async function subscribeToEvents(topics: string[], callback: (msg: any) => void) {
  try {
    const queue = await channel.assertQueue('', { exclusive: true });

    for (const topic of topics) {
      await channel.bindQueue(queue.queue, 'marketplace', topic);
    }

    channel.consume(queue.queue, async (msg: any) => {
      if (msg) {
        const data = JSON.parse(msg.content.toString());
        try {
          await callback(data);
          channel.ack(msg);
        } catch (error) {
          logger.error('Event consumer callback failed', {
            topics,
            error,
          });
          channel.nack(msg, false, true);
        }
      }
    });

    logger.info(`Subscribed to topics: ${topics.join(', ')}`);
  } catch (error) {
    logger.error('Failed to subscribe to events:', error);
    throw error;
  }
}

export function getChannel() {
  return channel;
}
