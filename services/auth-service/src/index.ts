import './config/env'; // PHẢI import đầu tiên - load .env trước tất cả
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { sequelize, testConnection } from './database';
import { setupPassport } from './config/passport';
import authRoutes from './routes/auth.routes';
import logger from './utils/logger';
import { redisClient, connectRedis } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';
import { validateEnvironmentVariables } from './utils/envValidator';

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
    // Validate environment variables
    if (!validateEnvironmentVariables()) {
      logger.error('❌ Environment validation failed. Please fix the errors above.');
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      } else {
        logger.warn('⚠️  Continuing in development mode despite validation errors...');
      }
    }

    // Connect to PostgreSQL (required - app won't work without it)
    logger.info('Connecting to PostgreSQL...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to PostgreSQL after retries. Exiting...');
      process.exit(1);
    }
    
    // Sync database models (only if needed - init.sql already created tables)
    // Don't use alter: true if you already ran init.sql
    // await sequelize.sync({ alter: true });
    logger.info('✅ Database connection established - using init.sql schema');

    // Connect to Redis (optional - app can work without it)
    try {
      logger.info('Connecting to Redis...');
      await connectRedis();
    } catch (error: any) {
      logger.warn('⚠️  Redis connection failed, continuing without cache:', error.message);
    }

    // Connect to RabbitMQ (optional - app can work without it)
    try {
      logger.info('Connecting to RabbitMQ...');
      await connectRabbitMQ();
    } catch (error: any) {
      logger.warn('⚠️  RabbitMQ connection failed, continuing without events:', error.message);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Auth Service running on port ${PORT}`);
      logger.info('✅ Service is ready to accept requests');
    });
  } catch (error: any) {
    logger.error('❌ Failed to start server:', error.message);
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