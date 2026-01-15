import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from '../utils/logger';

// Create ioredis client for rate limiter (rate-limiter-flexible requires ioredis)
const redisRateLimiter = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis rate limiter: Max reconnection attempts reached');
      return null; // Stop reconnecting
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

// Redis-based rate limiters for service level (sau API Gateway)
// These work with Redis to provide distributed rate limiting across service instances

// General API rate limiter (Redis-based)
const createRedisRateLimiter = (points: number, duration: number, blockDuration: number) => {
  return new RateLimiterRedis({
    storeClient: redisRateLimiter,
    keyPrefix: 'rl_auth',
    points, // Number of requests
    duration, // Per duration (in seconds)
    blockDuration, // Block for duration (in seconds) if limit exceeded
    execEvenly: false, // Don't delay requests
  });
};

// General API rate limiter - 100 requests per 15 minutes
const generalLimiter = createRedisRateLimiter(100, 900, 60);

// Auth endpoints - 30 requests per 15 minutes
const authLimiter = createRedisRateLimiter(30, 900, 300);

// Login endpoint - 10 attempts per 15 minutes
const loginLimiter = createRedisRateLimiter(10, 900, 600);

// Register endpoint - 5 registrations per hour
const registerLimiter = createRedisRateLimiter(5, 3600, 1800);

// OTP endpoint - 5 requests per hour
const otpLimiter = createRedisRateLimiter(5, 3600, 1800);

// Password reset - 3 requests per hour
const passwordResetLimiter = createRedisRateLimiter(3, 3600, 1800);

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

// Auth endpoints rate limiter
export const authRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await authLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Auth rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many authentication requests',
      message: `Too many requests. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Login endpoint rate limiter
export const loginRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await loginLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Login rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: `Too many login attempts. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Register endpoint rate limiter
export const registerRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await registerLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Register rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts',
      message: `Too many registration attempts. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// OTP endpoint rate limiter
export const otpRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await otpLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`OTP rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many OTP requests',
      message: `Too many OTP requests. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Password reset rate limiter
export const passwordResetRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientId = getClientId(req);
    await passwordResetLimiter.consume(clientId);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
    logger.warn(`Password reset rate limit exceeded for IP: ${getClientId(req)}`);
    res.status(429).json({
      success: false,
      error: 'Too many password reset requests',
      message: `Too many password reset requests. Please try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
};

// Profile update - 20 updates per hour
const profileUpdateLimiter = createRedisRateLimiter(20, 3600, 300);

// Avatar upload - 10 uploads per hour
const avatarUploadLimiter = createRedisRateLimiter(10, 3600, 600);

// Search users - 60 searches per 15 minutes
const searchLimiter = createRedisRateLimiter(60, 900, 60);

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

