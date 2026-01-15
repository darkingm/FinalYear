import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from '../utils/logger';

// Create ioredis client for rate limiter
const redisRateLimiter = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis rate limiter: Max reconnection attempts reached');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redisRateLimiter.on('error', (err) => {
  logger.error('Redis rate limiter error:', err.message);
});

redisRateLimiter.on('connect', () => {
  logger.info('Redis rate limiter connected');
});

// Get client identifier
const getClientId = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : req.ip || req.socket.remoteAddress || 'unknown';
  return ip;
};

// Create Redis rate limiter
const createRedisRateLimiter = (points: number, duration: number, blockDuration: number, keyPrefix: string) => {
  return new RateLimiterRedis({
    storeClient: redisRateLimiter,
    keyPrefix,
    points,
    duration,
    blockDuration,
    execEvenly: false,
  });
};

// General API rate limiter - 100 requests per 15 minutes
const generalLimiter = createRedisRateLimiter(100, 900, 60, 'rl_user');

// Profile update - 20 updates per hour
const profileUpdateLimiter = createRedisRateLimiter(20, 3600, 300, 'rl_user_profile');

// Avatar upload - 10 uploads per hour
const avatarUploadLimiter = createRedisRateLimiter(10, 3600, 600, 'rl_user_avatar');

// Search users - 60 searches per 15 minutes
const searchLimiter = createRedisRateLimiter(60, 900, 60, 'rl_user_search');

// General rate limiter middleware
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await generalLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Profile update rate limiter
export const profileUpdateRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await profileUpdateLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Profile update rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many profile update requests',
      message: `Too many profile updates. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Avatar upload rate limiter
export const avatarUploadRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await avatarUploadLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Avatar upload rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many avatar upload requests',
      message: `Too many avatar uploads. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Search rate limiter
export const searchRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await searchLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Search rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many search requests',
      message: `Too many searches. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};


