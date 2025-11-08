import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import tokenRoutes from './routes/token.routes';
import transactionRoutes from './routes/transaction.routes';
import walletRoutes from './routes/wallet.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';

dotenv.config();

const app: Application = express();
const PORT = process.env.BLOCKCHAIN_SERVICE_PORT || 3007;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'blockchain-service' });
});

app.use('/api/tokens', tokenRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallets', walletRoutes);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_BLOCKCHAIN || 'blockchain_db';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    logger.info('MongoDB connected');

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    app.listen(PORT, () => {
      logger.info(`Blockchain Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
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

