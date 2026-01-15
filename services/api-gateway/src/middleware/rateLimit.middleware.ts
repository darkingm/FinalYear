import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger';

// In-memory rate limiters - trước khi query Redis
// Sử dụng sliding window algorithm

// General API rate limiter
const generalLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // Per 15 minutes (in seconds)
  blockDuration: 60, // Block for 1 minute if limit exceeded
});

// Auth endpoints - stricter limits
const authLimiter = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 900, // Per 15 minutes
  blockDuration: 300, // Block for 5 minutes
});

// Login endpoint - very strict
const loginLimiter = new RateLimiterMemory({
  points: 5, // 5 login attempts
  duration: 900, // Per 15 minutes
  blockDuration: 600, // Block for 10 minutes
});

// Register endpoint
const registerLimiter = new RateLimiterMemory({
  points: 3, // 3 registrations
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes
});

// OTP endpoint
const otpLimiter = new RateLimiterMemory({
  points: 5, // 5 OTP requests
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes
});

// Get client identifier (IP address)
const getClientId = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : req.ip || req.socket.remoteAddress || 'unknown';
  return ip;
};

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


