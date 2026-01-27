import './config/env'; // PHẢI import đầu tiên - load .env trước tất cả
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { sequelize, testConnection } from './database';
import { userSequelize, testUserConnection } from './database/userDatabase';
import { setupPassport } from './config/passport';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import walletRoutes from './routes/wallet.routes';
import adminWalletRoutes from './routes/adminWallet.routes';
import logger from './utils/logger';
import { redisClient, connectRedis } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';
import { validateEnvironmentVariables } from './utils/envValidator';
// Email worker and monitoring
import { startEmailWorker } from './workers/email.worker';
import { startMonitoring, getHealthCheck } from './utils/monitoring';
// Error handling
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';

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
app.get('/health', async (req, res) => {
  const health = await getHealthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.use('/api/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/admin/wallets', adminWalletRoutes);

// Error handlers (MUST be last)
app.use(notFoundHandler);
app.use(errorHandler);

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
    logger.info('Connecting to PostgreSQL (auth_db)...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to PostgreSQL (auth_db) after retries. Exiting...');
      process.exit(1);
    }
    
    // Sync database models (only if needed - init.sql already created tables)
    // Don't use alter: true if you already ran init.sql
    // await sequelize.sync({ alter: true });
    logger.info('✅ Database connection established (auth_db) - using init.sql schema');

    // Connect to user_db (for user profiles)
    logger.info('Connecting to PostgreSQL (user_db)...');
    const userDbConnected = await testUserConnection();
    if (!userDbConnected) {
      logger.warn('⚠️  Failed to connect to PostgreSQL (user_db). User profile features may not work.');
    } else {
      logger.info('✅ Database connection established (user_db)');
    }

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
      
      // Start email worker after RabbitMQ connection
      logger.info('Starting email worker...');
      await startEmailWorker();
    } catch (error: any) {
      logger.warn('⚠️  RabbitMQ connection failed, continuing without events:', error.message);
    }

    // Start monitoring service
    startMonitoring();

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
  await userSequelize.close();
  await redisClient.disconnect();
  process.exit(0);
});

startServer();

export default app;