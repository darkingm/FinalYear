import { createClient } from 'redis';
import { logger } from '../utils/logger';
import 'dotenv/config';
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Payment service Redis connected'));

export async function connectRedis() {
  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

export async function setCache(key: string, value: any, expirySeconds?: number) {
  const data = JSON.stringify(value);
  if (expirySeconds) {
    await redisClient.setEx(key, expirySeconds, data);
  } else {
    await redisClient.set(key, data);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

export async function deleteCache(key: string) {
  await redisClient.del(key);
}
