import { redisClient } from './redis';
import logger from './logger';

// Helper functions for Redis operations (similar to auth-service)
const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    return await redisClient.get(key);
  } catch (error: any) {
    logger.error('Redis GET error:', error.message);
    return null;
  }
};

const safeRedisSet = async (key: string, value: string, ttl?: number): Promise<boolean> => {
  try {
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

const safeRedisDel = async (key: string): Promise<boolean> => {
  try {
    await redisClient.del(key);
    return true;
  } catch (error: any) {
    logger.error('Redis DEL error:', error.message);
    return false;
  }
};

// Local in-memory cache for hot keys (L1 cache)
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

class LocalCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly hotKeyThreshold: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 30000, hotKeyThreshold: number = 10) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.hotKeyThreshold = hotKeyThreshold;
    setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, {
      value,
      expiresAt,
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    if (lruKey) this.cache.delete(lruKey);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  isHotKey(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? entry.accessCount >= this.hotKeyThreshold : false;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hotKeys: Array.from(this.cache.entries())
        .filter(([_, entry]) => entry.accessCount >= this.hotKeyThreshold)
        .map(([key, entry]) => ({ key, accessCount: entry.accessCount })),
    };
  }
}

const localCache = new LocalCache(1000, 30000, 10);
const pendingRequests = new Map<string, Promise<any>>();

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300,
  useLocalCache: boolean = true
): Promise<T> {
  if (useLocalCache) {
    const localValue = localCache.get<T>(key);
    if (localValue !== null) return localValue;
  }

  const pendingRequest = pendingRequests.get(key);
  if (pendingRequest) {
    try {
      return await pendingRequest;
    } catch (error) {
      // Continue to fetch
    }
  }

  const fetchPromise = (async () => {
    try {
      const redisValue = await safeRedisGet(key);
      if (redisValue) {
        try {
          const parsed = JSON.parse(redisValue) as T;
          if (useLocalCache) {
            localCache.set(key, parsed, ttl * 1000);
          }
          return parsed;
        } catch (parseError) {
          logger.warn(`Failed to parse cached value for key: ${key}`);
        }
      }

      const value = await fetchFn();
      await safeRedisSet(key, JSON.stringify(value), ttl);
      if (useLocalCache) {
        localCache.set(key, value, ttl * 1000);
      }
      return value;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, fetchPromise);
  return fetchPromise;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = 300,
  useLocalCache: boolean = true
): Promise<void> {
  await safeRedisSet(key, JSON.stringify(value), ttl);
  if (useLocalCache) {
    localCache.set(key, value, ttl * 1000);
  }
}

export async function deleteCached(key: string): Promise<void> {
  await safeRedisDel(key);
  localCache.delete(key);
  pendingRequests.delete(key);
}

export async function invalidatePattern(pattern: string): Promise<void> {
  for (const key of localCache['cache'].keys()) {
    if (key.includes(pattern)) {
      localCache.delete(key);
      await safeRedisDel(key);
    }
  }
}

export function getShardedKey(baseKey: string, shardCount: number = 10): string {
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    hash = ((hash << 5) - hash) + baseKey.charCodeAt(i);
    hash = hash & hash;
  }
  const shard = Math.abs(hash) % shardCount;
  return `${baseKey}:shard:${shard}`;
}

export function getCacheStats() {
  return {
    localCache: localCache.getStats(),
    pendingRequests: pendingRequests.size,
  };
}

export { localCache };

