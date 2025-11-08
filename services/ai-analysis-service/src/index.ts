import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cron from 'node-cron';
import analysisRoutes from './routes/analysis.routes';
import reportRoutes from './routes/report.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';
import { generateDailyReport } from './services/report.service';
import { updateMarketAnalysis } from './services/analysis.service';

dotenv.config();

const app: Application = express();
const PORT = process.env.AI_SERVICE_PORT || 3010;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'ai-analysis-service' });
});

app.use('/api/analysis', analysisRoutes);
app.use('/api/reports', reportRoutes);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_AI || 'ai_analysis_db';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    logger.info('MongoDB connected');

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    // Schedule cron jobs
    setupCronJobs();

    app.listen(PORT, () => {
      logger.info(`AI Analysis Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Setup cron jobs
const setupCronJobs = () => {
  // Update market analysis every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly market analysis update');
    await updateMarketAnalysis();
  });

  // Generate daily report at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Generating daily market report');
    await generateDailyReport();
  });

  logger.info('Cron jobs scheduled');
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

