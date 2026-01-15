import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

// Configuration
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5');
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_SECONDS || '900'); // 15 minutes
const ATTEMPT_WINDOW = parseInt(process.env.ATTEMPT_WINDOW_SECONDS || '900'); // 15 minutes

// Get client identifier
const getClientId = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : req.ip || req.socket.remoteAddress || 'unknown';
  return ip;
};

// Track failed login attempt
export const trackFailedAttempt = async (identifier: string, type: 'ip' | 'email'): Promise<void> => {
  try {
    const key = type === 'ip' 
      ? `bf:ip:${identifier}`
      : `bf:email:${identifier}`;
    
    const attempts = await redisClient.incr(key);
    
    // Set TTL on first attempt
    if (attempts === 1) {
      await redisClient.expire(key, ATTEMPT_WINDOW);
    }
    
    // If max attempts reached, set lockout
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutKey = type === 'ip'
        ? `bf:lockout:ip:${identifier}`
        : `bf:lockout:email:${identifier}`;
      
      await redisClient.setEx(lockoutKey, LOCKOUT_DURATION, '1');
      logger.warn(`Brute force lockout triggered for ${type}: ${identifier}`, {
        attempts,
        lockoutDuration: LOCKOUT_DURATION,
      });
    }
  } catch (error: any) {
    logger.error('Failed to track brute force attempt:', error.message);
    // Don't throw - allow request to continue
  }
};

// Clear failed attempts on successful login
export const clearFailedAttempts = async (identifier: string, type: 'ip' | 'email'): Promise<void> => {
  try {
    const attemptKey = type === 'ip'
      ? `bf:ip:${identifier}`
      : `bf:email:${identifier}`;
    const lockoutKey = type === 'ip'
      ? `bf:lockout:ip:${identifier}`
      : `bf:lockout:email:${identifier}`;
    
    await redisClient.del(attemptKey);
    await redisClient.del(lockoutKey);
  } catch (error: any) {
    logger.error('Failed to clear brute force attempts:', error.message);
  }
};

// Check if identifier is locked out
const isLockedOut = async (identifier: string, type: 'ip' | 'email'): Promise<{ locked: boolean; remainingSeconds?: number }> => {
  try {
    const lockoutKey = type === 'ip'
      ? `bf:lockout:ip:${identifier}`
      : `bf:lockout:email:${identifier}`;
    
    const ttl = await redisClient.ttl(lockoutKey);
    
    if (ttl > 0) {
      return { locked: true, remainingSeconds: ttl };
    }
    
    return { locked: false };
  } catch (error: any) {
    logger.error('Failed to check lockout status:', error.message);
    return { locked: false };
  }
};

// Get remaining attempts
const getRemainingAttempts = async (identifier: string, type: 'ip' | 'email'): Promise<number> => {
  try {
    const key = type === 'ip'
      ? `bf:ip:${identifier}`
      : `bf:email:${identifier}`;
    
    const attempts = await redisClient.get(key);
    const count = attempts ? parseInt(attempts) : 0;
    
    return Math.max(0, MAX_FAILED_ATTEMPTS - count);
  } catch (error: any) {
    logger.error('Failed to get remaining attempts:', error.message);
    return MAX_FAILED_ATTEMPTS;
  }
};

// Brute force protection middleware for login endpoint
export const bruteForceProtection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip = getClientId(req);
    const email = req.body?.email?.toLowerCase()?.trim();
    
    // Check IP lockout
    const ipLockout = await isLockedOut(ip, 'ip');
    if (ipLockout.locked) {
      logger.warn(`Blocked login attempt from locked IP: ${ip}`, {
        remainingSeconds: ipLockout.remainingSeconds,
      });
      return res.status(429).json({
        success: false,
        error: 'Too many failed login attempts',
        message: `Your IP has been temporarily locked due to too many failed login attempts. Please try again in ${ipLockout.remainingSeconds} seconds.`,
        retryAfter: ipLockout.remainingSeconds,
      });
    }
    
    // Check email lockout if email provided
    if (email) {
      const emailLockout = await isLockedOut(email, 'email');
      if (emailLockout.locked) {
        logger.warn(`Blocked login attempt for locked email: ${email}`, {
          remainingSeconds: emailLockout.remainingSeconds,
        });
        return res.status(429).json({
          success: false,
          error: 'Account temporarily locked',
          message: `This account has been temporarily locked due to too many failed login attempts. Please try again in ${emailLockout.remainingSeconds} seconds.`,
          retryAfter: emailLockout.remainingSeconds,
        });
      }
    }
    
    // Attach helper functions to request for use in controller
    (req as any).trackFailedLogin = async () => {
      await trackFailedAttempt(ip, 'ip');
      if (email) {
        await trackFailedAttempt(email, 'email');
      }
    };
    
    (req as any).clearFailedLogin = async () => {
      await clearFailedAttempts(ip, 'ip');
      if (email) {
        await clearFailedAttempts(email, 'email');
      }
    };
    
    (req as any).getRemainingAttempts = async () => {
      const ipAttempts = await getRemainingAttempts(ip, 'ip');
      const emailAttempts = email ? await getRemainingAttempts(email, 'email') : MAX_FAILED_ATTEMPTS;
      return Math.min(ipAttempts, emailAttempts);
    };
    
    next();
  } catch (error: any) {
    logger.error('Brute force protection error:', error);
    // On error, allow request to continue (fail open)
    next();
  }
};


