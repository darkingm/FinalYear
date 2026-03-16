import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter, strictLimiter } from './middleware/rate-limit';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectRabbitMQ } from './config/rabbitmq';
import { startWorkers } from './workers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all requests
app.use(apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// API Routes
import cryptoPaymentRoutes from './modules/crypto-payment/crypto-payment.routes';
import paypalRoutes from './modules/paypal/paypal.routes';
import pricingRoutes from './modules/pricing/pricing.routes';

app.use('/api/payments/crypto', strictLimiter, cryptoPaymentRoutes);
app.use('/api/payments/paypal', strictLimiter, paypalRoutes);
app.use('/api/pricing', strictLimiter, pricingRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDatabase();

    // Redis is optional — used for price caching only
    // If Redis fails, service still works (fetches from Binance directly)
    try {
      await connectRedis();
      logger.info('Redis connected successfully');
    } catch (redisErr: any) {
      logger.warn('Redis unavailable — continuing without cache:', redisErr?.message || redisErr);
    }

    // RabbitMQ is optional — used for async notifications
    try {
      await connectRabbitMQ();
    } catch (mqErr: any) {
      logger.warn('RabbitMQ unavailable — continuing without message queue:', mqErr?.message || mqErr);
    }

    // Start background workers
    startWorkers();

    app.listen(PORT, () => {
      logger.info(`Payment API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server (DB connection required):', error);
    process.exit(1);
  }
}

startServer();

export default app;
