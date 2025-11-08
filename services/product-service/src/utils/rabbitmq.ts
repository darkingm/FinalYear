import amqp, { Channel, Connection } from 'amqplib';
import logger from './logger';

let connection: Connection | null = null;
let channel: Channel | null = null;

export const connectRabbitMQ = async (): Promise<void> => {
  try {
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange('tokenasset_events', 'topic', { durable: true });

    logger.info('RabbitMQ connected');
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    // Don't throw, allow service to start without RabbitMQ
  }
};

export const publishEvent = async (eventName: string, data: any): Promise<void> => {
  try {
    if (!channel) {
      logger.warn('RabbitMQ channel not initialized');
      return;
    }

    const message = JSON.stringify({
      event: eventName,
      data,
      timestamp: new Date().toISOString(),
    });

    channel.publish(
      'tokenasset_events',
      eventName,
      Buffer.from(message),
      { persistent: true }
    );

    logger.info('Event published:', { eventName });
  } catch (error) {
    logger.error('Failed to publish event:', error);
  }
};

