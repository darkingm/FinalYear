import { getCached, setCached, deleteCached, invalidatePattern } from '../utils/redisHotKey';
import User from '../models/User.model';
import logger from '../utils/logger';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  USER: 300, // 5 minutes
  USER_BY_EMAIL: 300,
  USER_BY_USERNAME: 300,
  SESSION: 604800, // 7 days
  OTP: 600, // 10 minutes
};

// Cache key generators
const getUserCacheKey = (userId: string): string => `user:${userId}`;
const getUserByEmailCacheKey = (email: string): string => `user:email:${email.toLowerCase()}`;
const getUserByUsernameCacheKey = (username: string): string => `user:username:${username.toLowerCase()}`;
const getSessionCacheKey = (userId: string): string => `session:${userId}`;
const getOTPCacheKey = (email: string, type: string): string => `otp:${email}:${type}`;

/**
 * Cache-first user lookup by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return getCached<User | null>(
    getUserCacheKey(userId),
    async () => {
      const user = await User.findByPk(userId);
      return user;
    },
    CACHE_TTL.USER
  );
}

/**
 * Cache-first user lookup by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  return getCached<User | null>(
    getUserByEmailCacheKey(normalizedEmail),
    async () => {
      const user = await User.findOne({ where: { email: normalizedEmail } });
      return user;
    },
    CACHE_TTL.USER_BY_EMAIL
  );
}

/**
 * Cache-first user lookup by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const normalizedUsername = username.toLowerCase().trim();
  return getCached<User | null>(
    getUserByUsernameCacheKey(normalizedUsername),
    async () => {
      const user = await User.findOne({ where: { username: normalizedUsername } });
      return user;
    },
    CACHE_TTL.USER_BY_USERNAME
  );
}

/**
 * Cache session data
 */
export async function cacheSession(userId: string, sessionData: any): Promise<void> {
  await setCached(
    getSessionCacheKey(userId),
    sessionData,
    CACHE_TTL.SESSION
  );
}

/**
 * Get cached session
 */
export async function getCachedSession(userId: string): Promise<any | null> {
  return getCached<any | null>(
    getSessionCacheKey(userId),
    async () => null, // Session only exists in cache, not in DB
    CACHE_TTL.SESSION
  );
}

/**
 * Invalidate user cache (call after user updates)
 */
export async function invalidateUserCache(userId: string, email?: string, username?: string): Promise<void> {
  try {
    // Delete all user-related cache entries
    await deleteCached(getUserCacheKey(userId));
    
    if (email) {
      await deleteCached(getUserByEmailCacheKey(email));
    }
    
    if (username) {
      await deleteCached(getUserByUsernameCacheKey(username));
    }
    
    // Invalidate session cache
    await deleteCached(getSessionCacheKey(userId));
    
    logger.debug(`Invalidated cache for user: ${userId}`);
  } catch (error: any) {
    logger.error('Failed to invalidate user cache:', error.message);
  }
}

/**
 * Invalidate all user caches (for admin operations)
 */
export async function invalidateAllUserCaches(): Promise<void> {
  try {
    await invalidatePattern('user:');
    await invalidatePattern('session:');
    logger.debug('Invalidated all user caches');
  } catch (error: any) {
    logger.error('Failed to invalidate all user caches:', error.message);
  }
}

/**
 * Cache OTP
 */
export async function cacheOTP(email: string, type: string, otpData: any): Promise<void> {
  await setCached(
    getOTPCacheKey(email, type),
    otpData,
    CACHE_TTL.OTP
  );
}

/**
 * Get cached OTP
 */
export async function getCachedOTP(email: string, type: string): Promise<any | null> {
  return getCached<any | null>(
    getOTPCacheKey(email, type),
    async () => null,
    CACHE_TTL.OTP
  );
}

/**
 * Delete cached OTP
 */
export async function deleteCachedOTP(email: string, type: string): Promise<void> {
  await deleteCached(getOTPCacheKey(email, type));
}

/**
 * Cache warming - preload frequently accessed users
 */
export async function warmUserCache(userIds: string[]): Promise<void> {
  try {
    const promises = userIds.map(userId => getUserById(userId));
    await Promise.all(promises);
    logger.info(`Warmed cache for ${userIds.length} users`);
  } catch (error: any) {
    logger.error('Failed to warm user cache:', error.message);
  }
}


