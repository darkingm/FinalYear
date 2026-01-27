import express, { Application } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cron from 'node-cron';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import coinRoutes from './routes/coin.routes';
import shopRoutes from './routes/shop.routes';
import { fetchCoinData } from './services/coinmarket.service';
import { updateCoinPricesFromExchanges } from './services/binance.service';
import realtimePriceService from './services/realtimePrice.service';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
const PORT = process.env.PRODUCT_SERVICE_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'product-service' });
});

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/shops', shopRoutes);

// Initialize RealtimePriceService
realtimePriceService.initialize(io);
logger.info('RealtimePriceService initialized');

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_PRODUCT || 'product_db';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    logger.info(`MongoDB connected: ${mongoUri}/${dbName}`);
    
    // Also connect to coin market database if different
    const coinDbName = process.env.MONGODB_DB_COIN || 'coin_market_db';
    if (coinDbName !== dbName) {
      // Use same connection but different database
      const coinConnection = mongoose.createConnection(`${mongoUri}/${coinDbName}`);
      logger.info(`Coin database connection ready: ${mongoUri}/${coinDbName}`);
    }

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    // Initial coin data fetch (don't block startup)
    fetchCoinData().catch((error: any) => {
      logger.error('Initial coin data fetch failed:', error.message);
    });

    // Initial price update from Binance/Coinbase
    updateCoinPricesFromExchanges().catch((error: any) => {
      logger.error('Initial price update from exchanges failed:', error.message);
    });

    // Cron job to update coin prices from CoinGecko every 5 minutes (fallback)
    cron.schedule('*/5 * * * *', async () => {
      logger.info('Fetching latest coin data from CoinGecko...');
      await fetchCoinData();
    });

    // Cron job to update coin prices from Binance/Coinbase every 30 seconds (real-time)
    cron.schedule('*/30 * * * * *', async () => {
      logger.debug('Updating coin prices from Binance/Coinbase...');
      await updateCoinPricesFromExchanges();
    });

    httpServer.listen(PORT, () => {
      logger.info(`Product Service running on port ${PORT}`);
      logger.info(`WebSocket available at ws://localhost:${PORT}`);
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
  realtimePriceService.stop();
  await mongoose.connection.close();
  await redisClient.disconnect();
  io.close();
  process.exit(0);
});

startServer();

export default app;

