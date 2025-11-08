import amqp, { Channel, Connection } from 'amqplib';
import UserProfile from '../models/UserProfile.model';
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

// Subscribe to events from other services
export const subscribeToEvents = async (): Promise<void> => {
  try {
    if (!channel) {
      logger.warn('RabbitMQ channel not initialized');
      return;
    }

    // Create queue for user service
    const queue = await channel.assertQueue('user_service_queue', { durable: true });

    // Bind to user registration events from auth service
    await channel.bindQueue(queue.queue, 'tokenasset_events', 'user.registered');

    // Consume messages
    channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await handleEvent(event);
          channel?.ack(msg);
        } catch (error) {
          logger.error('Failed to handle event:', error);
          channel?.nack(msg, false, false);
        }
      }
    });

    logger.info('Subscribed to events');
  } catch (error) {
    logger.error('Failed to subscribe to events:', error);
  }
};

// Handle incoming events
const handleEvent = async (event: any): Promise<void> => {
  const { event: eventName, data } = event;

  switch (eventName) {
    case 'user.registered':
      // Create user profile when user registers
      await createUserProfile(data);
      break;
    
    default:
      logger.debug('Unhandled event:', eventName);
  }
};

// Create user profile from registration event
const createUserProfile = async (data: any): Promise<void> => {
  try {
    const existingProfile = await UserProfile.findOne({
      where: { userId: data.userId },
    });

    if (!existingProfile) {
      await UserProfile.create({
        userId: data.userId,
        email: data.email,
        username: data.username,
        fullName: data.fullName,
        role: 'USER',
        isSeller: false,
        sellerVerified: false,
        bankVerified: false,
        bankVerificationStatus: 'PENDING',
        showCoinBalance: true,
        showJoinDate: true,
        showEmail: false,
        showPhone: false,
        totalSales: 0,
        totalPurchases: 0,
        rating: 0,
        reviewCount: 0,
        isActive: true,
        isSuspended: false,
      });

      logger.info('User profile created:', { userId: data.userId });
    }
  } catch (error) {
    logger.error('Failed to create user profile:', error);
  }
};

