import amqp, { Channel, Connection } from 'amqplib';
import Payment, { PaymentStatus } from '../models/Payment.model';
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

    // Create queue for payment service
    const queue = await channel.assertQueue('payment_service_queue', { durable: true });

    // Bind to order events
    await channel.bindQueue(queue.queue, 'tokenasset_events', 'order.created');
    await channel.bindQueue(queue.queue, 'tokenasset_events', 'order.cancelled');

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
    case 'order.created':
      // Create payment record for order
      await createPaymentForOrder(data);
      break;

    case 'order.cancelled':
      // Cancel associated payment
      await cancelPaymentForOrder(data);
      break;
    
    default:
      logger.debug('Unhandled event:', eventName);
  }
};

// Create payment record when order is created
const createPaymentForOrder = async (data: any): Promise<void> => {
  try {
    const { orderId, userId, totalInCoins, totalInUSD, paymentMethod } = data;

    const existingPayment = await Payment.findOne({
      where: { orderId },
    });

    if (!existingPayment && paymentMethod === 'COIN') {
      await Payment.create({
        userId,
        orderId,
        amount: totalInCoins,
        currency: 'BTC', // Default, should be configurable
        paymentMethod: 'COIN',
        status: PaymentStatus.PENDING,
      });

      logger.info('Payment record created for order:', { orderId });
    }
  } catch (error) {
    logger.error('Failed to create payment for order:', error);
  }
};

// Cancel payment when order is cancelled
const cancelPaymentForOrder = async (data: any): Promise<void> => {
  try {
    const { orderId } = data;

    const payment = await Payment.findOne({
      where: { orderId, status: PaymentStatus.PENDING },
    });

    if (payment) {
      payment.status = PaymentStatus.CANCELLED;
      await payment.save();

      logger.info('Payment cancelled for order:', { orderId });
    }
  } catch (error) {
    logger.error('Failed to cancel payment:', error);
  }
};

