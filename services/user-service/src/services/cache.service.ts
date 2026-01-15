import { getCached, setCached, deleteCached, invalidatePattern } from '../utils/redisHotKey';
import UserProfile from '../models/UserProfile.model';
import logger from '../utils/logger';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  USER_PROFILE: 300, // 5 minutes
  USER_PROFILE_BY_USERNAME: 300,
  DASHBOARD_STATS: 60, // 1 minute
  USER_BALANCES: 30, // 30 seconds
};

// Cache key generators
const getUserProfileCacheKey = (userId: string): string => `user_profile:${userId}`;
const getUserProfileByUsernameCacheKey = (username: string): string => `user_profile:username:${username.toLowerCase()}`;
const getDashboardStatsCacheKey = (userId: string): string => `dashboard_stats:${userId}`;
const getUserBalancesCacheKey = (userId: string): string => `user_balances:${userId}`;

/**
 * Cache-first user profile lookup by ID
 */
export async function getUserProfileById(userId: string): Promise<UserProfile | null> {
  return getCached<UserProfile | null>(
    getUserProfileCacheKey(userId),
    async () => {
      const profile = await UserProfile.findOne({ where: { userId } });
      return profile;
    },
    CACHE_TTL.USER_PROFILE
  );
}

/**
 * Cache-first user profile lookup by username
 */
export async function getUserProfileByUsername(username: string): Promise<UserProfile | null> {
  const normalizedUsername = username.toLowerCase().trim();
  return getCached<UserProfile | null>(
    getUserProfileByUsernameCacheKey(normalizedUsername),
    async () => {
      const profile = await UserProfile.findOne({ where: { username: normalizedUsername } });
      return profile;
    },
    CACHE_TTL.USER_PROFILE_BY_USERNAME
  );
}

/**
 * Cache dashboard stats
 */
export async function getCachedDashboardStats(userId: string, fetchFn: () => Promise<any>): Promise<any> {
  return getCached(
    getDashboardStatsCacheKey(userId),
    fetchFn,
    CACHE_TTL.DASHBOARD_STATS
  );
}

/**
 * Cache user balances
 */
export async function getCachedUserBalances(userId: string, fetchFn: () => Promise<any>): Promise<any> {
  return getCached(
    getUserBalancesCacheKey(userId),
    fetchFn,
    CACHE_TTL.USER_BALANCES
  );
}

/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfileCache(userId: string, username?: string): Promise<void> {
  try {
    await deleteCached(getUserProfileCacheKey(userId));
    
    if (username) {
      await deleteCached(getUserProfileByUsernameCacheKey(username));
    }
    
    // Also invalidate related caches
    await deleteCached(getDashboardStatsCacheKey(userId));
    await deleteCached(getUserBalancesCacheKey(userId));
    
    logger.debug(`Invalidated cache for user profile: ${userId}`);
  } catch (error: any) {
    logger.error('Failed to invalidate user profile cache:', error.message);
  }
}

/**
 * Invalidate all user profile caches
 */
export async function invalidateAllUserProfileCaches(): Promise<void> {
  try {
    await invalidatePattern('user_profile:');
    await invalidatePattern('dashboard_stats:');
    await invalidatePattern('user_balances:');
    logger.debug('Invalidated all user profile caches');
  } catch (error: any) {
    logger.error('Failed to invalidate all user profile caches:', error.message);
  }
}

/**
 * Cache warming - preload frequently accessed profiles
 */
export async function warmUserProfileCache(userIds: string[]): Promise<void> {
  try {
    const promises = userIds.map(userId => getUserProfileById(userId));
    await Promise.all(promises);
    logger.info(`Warmed cache for ${userIds.length} user profiles`);
  } catch (error: any) {
    logger.error('Failed to warm user profile cache:', error.message);
  }
}

/**
 * Update cached user profile (after DB update)
 */
export async function updateCachedUserProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    await setCached(
      getUserProfileCacheKey(userId),
      profile,
      CACHE_TTL.USER_PROFILE
    );
    
    if (profile.username) {
      await setCached(
        getUserProfileByUsernameCacheKey(profile.username),
        profile,
        CACHE_TTL.USER_PROFILE_BY_USERNAME
      );
    }
  } catch (error: any) {
    logger.error('Failed to update cached user profile:', error.message);
  }
}


