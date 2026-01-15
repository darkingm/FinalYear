import amqp, { Channel, Connection } from 'amqplib';
import logger from './logger';

let connection: Connection | null = null;
let channel: Channel | null = null;
let isConnecting = false;

export const connectRabbitMQ = async (): Promise<void> => {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    logger.warn('RabbitMQ connection already in progress, skipping...');
    return;
  }

  if (connection && connection.connection && connection.connection.readyState === 'open') {
    logger.info('RabbitMQ already connected');
    return;
  }

  isConnecting = true;

  try {
    const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
    const RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
    const RABBITMQ_USER = process.env.RABBITMQ_USER || 'guest';
    const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'guest';
    
    const RABBITMQ_URL = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
    
    logger.info(`Attempting to connect to RabbitMQ at ${RABBITMQ_HOST}:${RABBITMQ_PORT}`);
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Setup exchange for events
    await channel.assertExchange('tokenasset_events', 'topic', { durable: true });

    // Setup email queue
    await channel.assertQueue('email_queue', {
      durable: true, // Queue survives broker restart
      arguments: {
        'x-message-ttl': 86400000, // 24 hours TTL for messages
        'x-max-priority': 10, // Support priority messages
      },
    });

    // Setup dead letter queue for failed emails
    await channel.assertQueue('email_queue_dlq', {
      durable: true,
    });

    // Bind email queue to exchange (optional, for event-based emails)
    await channel.bindQueue('email_queue', 'tokenasset_events', 'email.send');

    logger.info('✅ RabbitMQ connected successfully');
    logger.info('✅ Email queue setup completed');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
      connection = null;
      channel = null;
      isConnecting = false;
      // Don't throw, just log - allow app to continue
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      connection = null;
      channel = null;
      isConnecting = false;
      
      // Attempt to reconnect after delay
      setTimeout(() => {
        if (!connection || !channel) {
          logger.info('Attempting to reconnect to RabbitMQ...');
          connectRabbitMQ().catch((err) => {
            logger.error('Failed to reconnect to RabbitMQ:', err.message);
          });
        }
      }, 5000);
    });

    isConnecting = false;
  } catch (error: any) {
    isConnecting = false;
    logger.error('Failed to connect to RabbitMQ:', error.message);
    logger.warn('Application will continue without RabbitMQ. Event publishing will be disabled.');
    // Don't throw - allow app to continue without RabbitMQ
    connection = null;
    channel = null;
  }
};

export const publishEvent = async (eventName: string, data: any): Promise<void> => {
  try {
    // Kiểm tra connection state
    if (!channel || !connection) {
      logger.warn('RabbitMQ not available. Event not published:', eventName);
      return;
    }

    // Kiểm tra connection còn active không
    // Note: amqplib connection.connection có thể không có readyState
    // Thay vào đó, kiểm tra bằng cách thử publish và catch error
    try {
      const message = JSON.stringify({
        event: eventName,
        data,
        timestamp: new Date().toISOString(),
      });

      const published = channel.publish(
        'tokenasset_events',
        eventName,
        Buffer.from(message),
        { persistent: true }
      );

      if (!published) {
        logger.warn('RabbitMQ channel buffer full. Event may not be published:', eventName);
      } else {
        logger.debug('Event published:', { eventName });
      }
    } catch (publishError: any) {
      // Connection might be closed, reset state
      logger.warn('Failed to publish event, connection may be closed:', publishError.message);
      connection = null;
      channel = null;
    }
  } catch (error: any) {
    logger.error('Failed to publish event:', error.message);
    // Don't throw - allow app to continue
  }
};

// Publish email to queue (SMTP chỉ nhận và enqueue, không retry logic phức tạp)
export const enqueueEmail = async (emailData: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  priority?: number; // 0-10, higher = more priority
}): Promise<void> => {
  try {
    if (!channel || !connection) {
      logger.warn('RabbitMQ not available. Email not enqueued:', emailData.to);
      return;
    }

    const message = JSON.stringify({
      ...emailData,
      timestamp: new Date().toISOString(),
      attempts: 0, // Track retry attempts
    });

    const published = channel.sendToQueue(
      'email_queue',
      Buffer.from(message),
      {
        persistent: true,
        priority: emailData.priority || 0,
      }
    );

    if (!published) {
      logger.warn('RabbitMQ channel buffer full. Email may not be enqueued:', emailData.to);
    } else {
      logger.info('Email enqueued:', {
        to: emailData.to,
        subject: emailData.subject,
        priority: emailData.priority || 0,
      });
    }
  } catch (error: any) {
    logger.error('Failed to enqueue email:', error.message);
    // Log error but don't throw - allow app to continue
    // Email will be logged for manual retry if needed
  }
};

// Get queue length for monitoring
export const getEmailQueueLength = async (): Promise<number> => {
  try {
    if (!channel) {
      return 0;
    }
    const queueInfo = await channel.checkQueue('email_queue');
    return queueInfo.messageCount;
  } catch (error: any) {
    logger.error('Failed to get email queue length:', error.message);
    return 0;
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
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }
};

// Export connection state for debugging
export const getRabbitMQState = () => ({
  isConnected: connection !== null && channel !== null,
  hasConnection: connection !== null,
  hasChannel: channel !== null,
});