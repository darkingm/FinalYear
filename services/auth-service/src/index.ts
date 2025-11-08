import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import { sequelize, testConnection } from './database';
import { setupPassport } from './config/passport';
import authRoutes from './routes/auth.routes';
import logger from './utils/logger';
import { redisClient, connectRedis } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport
app.use(passport.initialize());
setupPassport();

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'auth-service' });
});

app.use('/api/auth', authRoutes);

// Start server
const startServer = async () => {
  try {
    // Connect to PostgreSQL (required - app won't work without it)
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to PostgreSQL after retries. Exiting...');
      process.exit(1);
    }
    
    // Sync database models
    try {
      await sequelize.sync({ alter: true });
      logger.info('Database synced');
    } catch (error: any) {
      logger.error('Database sync error:', error.message);
      // Continue anyway - might be permission issue
    }

    // Connect to Redis (optional - app can work without it)
    try {
      await connectRedis();
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache:', error.message);
    }

    // Connect to RabbitMQ (optional - app can work without it)
    try {
      await connectRabbitMQ();
    } catch (error: any) {
      logger.warn('RabbitMQ connection failed, continuing without events:', error.message);
    }

    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
      logger.info('Service is ready to accept requests');
    });
  } catch (error: any) {
    logger.error('Failed to start server:', error.message);
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

