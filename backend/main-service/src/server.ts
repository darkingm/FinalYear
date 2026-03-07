import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectRabbitMQ } from './config/rabbitmq';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();

    app.listen(PORT, () => {
      logger.info(`Main API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Do NOT start server during tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
