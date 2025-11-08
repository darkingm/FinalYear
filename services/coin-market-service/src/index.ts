import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cron from 'node-cron';
import coinRoutes from './routes/coin.routes';
import { fetchCoinData } from './services/coinmarket.service';
import logger from './utils/logger';
import { redisClient } from './utils/redis';

dotenv.config();

const app: Application = express();
const PORT = process.env.COIN_MARKET_SERVICE_PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'coin-market-service' });
});

app.use('/api/coins', coinRoutes);

// Cron job to update coin prices every 1 minute
cron.schedule('*/1 * * * *', async () => {
  logger.info('Fetching latest coin data...');
  await fetchCoinData();
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB (required)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_COIN || 'coin_market_db';
    
    let mongoConnected = false;
    for (let i = 0; i < 3; i++) {
      try {
        await mongoose.connect(`${mongoUri}/${dbName}`);
        logger.info(`MongoDB connected: ${mongoUri}/${dbName}`);
        mongoConnected = true;
        break;
      } catch (error: any) {
        logger.error(`MongoDB connection attempt ${i + 1}/3 failed:`, error.message);
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
        }
      }
    }

    if (!mongoConnected) {
      logger.error('Failed to connect to MongoDB after retries. Exiting...');
      process.exit(1);
    }

    // Connect to Redis (optional)
    try {
      const { connectRedis } = await import('./utils/redis');
      await connectRedis();
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache:', error.message);
    }

    // Initial data fetch (don't block startup)
    fetchCoinData().catch((error: any) => {
      logger.error('Initial coin data fetch failed:', error.message);
    });

    app.listen(PORT, () => {
      logger.info(`Coin Market Service running on port ${PORT}`);
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
  await mongoose.connection.close();
  await redisClient.disconnect();
  process.exit(0);
});

startServer();

export default app;

