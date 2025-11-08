import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { sequelize } from './database';
import paymentRoutes from './routes/payment.routes';
import p2pRoutes from './routes/p2p.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ, subscribeToEvents } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'payment-service' });
});

app.use('/api/payments', paymentRoutes);
app.use('/api/p2p', p2pRoutes);

// Start server
const startServer = async () => {
  try {
    // Connect to PostgreSQL
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');

    // Sync models (development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced');
    }

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    await subscribeToEvents();
    logger.info('RabbitMQ connected');

    app.listen(PORT, () => {
      logger.info(`Payment Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await sequelize.close();
  await redisClient.disconnect();
  process.exit(0);
});

startServer();

export default app;

