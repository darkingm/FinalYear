import amqp, { Channel, Connection } from 'amqplib';
import logger from './logger';

let connection: Connection | null = null;
let channel: Channel | null = null;

export const connectRabbitMQ = async (): Promise<void> => {
  try {
    const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
    const RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
    const RABBITMQ_USER = process.env.RABBITMQ_USER || 'guest';
    const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'guest';
    
    const RABBITMQ_URL = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
    
    logger.info(`Attempting to connect to RabbitMQ at ${RABBITMQ_HOST}:${RABBITMQ_PORT}`);
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange('tokenasset_events', 'topic', { durable: true });

    logger.info('RabbitMQ connected successfully');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
      // Don't throw, just log - allow app to continue
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      // Attempt to reconnect after delay
      setTimeout(() => {
        if (!connection || connection.connection === null) {
          logger.info('Attempting to reconnect to RabbitMQ...');
          connectRabbitMQ().catch((err) => {
            logger.error('Failed to reconnect to RabbitMQ:', err);
          });
        }
      }, 5000);
    });
  } catch (error: any) {
    logger.error('Failed to connect to RabbitMQ:', error.message);
    logger.warn('Application will continue without RabbitMQ. Event publishing will be disabled.');
    // Don't throw - allow app to continue without RabbitMQ
    connection = null;
    channel = null;
  }
};

export const publishEvent = async (eventName: string, data: any): Promise<void> => {
  try {
    if (!channel || !connection) {
      logger.warn('RabbitMQ not available. Event not published:', eventName);
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
  } catch (error: any) {
    logger.error('Failed to publish event:', error.message);
    // Don't throw - allow app to continue
  }
};

export const subscribeToEvent = async (
  eventName: string,
  callback: (data: any) => void
): Promise<void> => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const queue = await channel.assertQueue('', { exclusive: true });

    await channel.bindQueue(queue.queue, 'tokenasset_events', eventName);

    channel.consume(queue.queue, (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          callback(content.data);
          channel?.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          channel?.nack(msg, false, false);
        }
      }
    });

    logger.info('Subscribed to event:', eventName);
  } catch (error) {
    logger.error('Failed to subscribe to event:', error);
    throw error;
  }
};

export const closeRabbitMQ = async (): Promise<void> => {
  try {
    await channel?.close();
    await connection?.close();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }
};

