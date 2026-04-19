import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectRabbitMQ } from './config/rabbitmq';
import { initCronJobs } from './utils/cron';
import { OrderPaymentEventsConsumer } from './modules/orders/order-payment-events.consumer';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDatabase();
    let orderPaymentEventsConsumer: OrderPaymentEventsConsumer | null = null;

    // Redis optional — cache only, not critical
    try {
      await connectRedis();
      logger.info('Redis connected');
    } catch (redisErr: any) {
      logger.warn('Redis unavailable, continuing without cache:', redisErr?.message);
    }

    // RabbitMQ optional — notifications only
    try {
      await connectRabbitMQ();
      orderPaymentEventsConsumer = new OrderPaymentEventsConsumer();
    } catch (mqErr: any) {
      logger.warn('RabbitMQ unavailable, continuing without queue:', mqErr?.message);
    }

    app.listen(PORT, () => {
      logger.info(`Main API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);

      // Initialize cron jobs
      initCronJobs();

      if (orderPaymentEventsConsumer) {
        orderPaymentEventsConsumer.start()
          .then(() => logger.info('Order payment projection consumer started'))
          .catch((error) => logger.error('Failed to start order payment projection consumer', error));
      }
    });
  } catch (error) {
    logger.error('Failed to start server (DB required):', error);
    process.exit(1);
  }
}

// Do NOT start server during tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
