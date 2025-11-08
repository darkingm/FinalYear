import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { sequelize } from './database';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'order-service' });
});

app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

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
    logger.info('RabbitMQ connected');

    app.listen(PORT, () => {
      logger.info(`Order Service running on port ${PORT}`);
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

