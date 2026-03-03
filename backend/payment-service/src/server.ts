import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectRabbitMQ } from './config/rabbitmq';
import { startWorkers } from './workers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/payments/crypto', cryptoPaymentRoutes);
app.use('/api/payments/paypal', paypalRoutes);
app.use('/api/pricing', pricingRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    
    // Start background workers
    startWorkers();

    app.listen(PORT, () => {
      logger.info(`Payment API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
