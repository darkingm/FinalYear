import { createClient } from 'redis';
import logger from './logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const redisClient = createClient({
  url: process.env.REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Max reconnection attempts reached');
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

let isConnected = false;

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err.message);
  isConnected = false;
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Connected and Ready');
  isConnected = true;
});

redisClient.on('end', () => {
  logger.warn('Redis Client Connection Ended');
  isConnected = false;
});

export const connectRedis = async (): Promise<void> => {
  try {
    logger.info(`Attempting to connect to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error: any) {
    logger.error('Failed to connect to Redis:', error.message);
    logger.warn('Application will continue without Redis. Caching will be disabled.');
    isConnected = false;
  }
};

export { redisClient };

