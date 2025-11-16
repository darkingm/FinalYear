import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { sequelize } from './database';
import userRoutes from './routes/user.routes';
import sellerRoutes from './routes/seller.routes';
import adminRoutes from './routes/admin.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ, subscribeToEvents } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const PORT = process.env.USER_SERVICE_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for avatars
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'user-service' });
});

app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/admin/users', adminRoutes);

// Start server
const startServer = async () => {
  try {
    // Connect to PostgreSQL (required)
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');

    // Sync models (development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced');
    }

    // Connect to Redis (optional)
    try {
      await redisClient.connect();
      logger.info('Redis connected');
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache:', error.message);
    }

    // Connect to RabbitMQ (optional)
    try {
      await connectRabbitMQ();
      await subscribeToEvents();
      logger.info('RabbitMQ connected');
    } catch (error: any) {
      logger.warn('RabbitMQ connection failed, continuing without events:', error.message);
    }

    app.listen(PORT, () => {
      logger.info(`User Service running on port ${PORT}`);
      logger.info('Service is ready to accept requests');
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

