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
        return false; // Stop reconnecting
      }
      return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
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

// Helper function to safely use Redis
export const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    if (!isConnected) {
      logger.warn('Redis not connected. Returning null for key:', key);
      return null;
    }
    return await redisClient.get(key);
  } catch (error: any) {
    logger.error('Redis GET error:', error.message);
    return null;
  }
};

export const safeRedisSet = async (key: string, value: string, ttl?: number): Promise<boolean> => {
  try {
    if (!isConnected) {
      logger.warn('Redis not connected. Cannot set key:', key);
      return false;
    }
    if (ttl) {
      await redisClient.setEx(key, ttl, value);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch (error: any) {
    logger.error('Redis SET error:', error.message);
    return false;
  }
};

export const safeRedisDel = async (key: string): Promise<boolean> => {
  try {
    if (!isConnected) {
      logger.warn('Redis not connected. Cannot delete key:', key);
      return false;
    }
    await redisClient.del(key);
    return true;
  } catch (error: any) {
    logger.error('Redis DEL error:', error.message);
    return false;
  }
};

// Connect with error handling
export const connectRedis = async (): Promise<void> => {
  try {
    logger.info(`Attempting to connect to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error: any) {
    logger.error('Failed to connect to Redis:', error.message);
    logger.warn('Application will continue without Redis. Caching will be disabled.');
    isConnected = false;
    // Don't throw - allow app to continue without Redis
  }
};

export { redisClient };

