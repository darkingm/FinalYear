import { redisClient, safeRedisGet, safeRedisSet, safeRedisDel } from './redis';
import logger from './logger';

// Local in-memory cache for hot keys (L1 cache)
// This prevents cache stampede and reduces Redis load for frequently accessed keys
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

class LocalCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number; // milliseconds
  private readonly hotKeyThreshold: number; // Access count to consider a key "hot"

  constructor(maxSize: number = 1000, defaultTTL: number = 30000, hotKeyThreshold: number = 10) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.hotKeyThreshold = hotKeyThreshold;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // If cache is full, remove least recently used entry
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

    if (lruKey) {
      this.cache.delete(lruKey);
    }
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

// Singleton instance
const localCache = new LocalCache(1000, 30000, 10);

// Cache stampede prevention using a simple lock mechanism
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Get value from cache with hot key handling
 * Strategy: Local Cache (L1) -> Redis (L2) -> Database (L3)
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300, // seconds
  useLocalCache: boolean = true
): Promise<T> {
  // 1. Check local cache first (for hot keys)
  if (useLocalCache) {
    const localValue = localCache.get<T>(key);
    if (localValue !== null) {
      return localValue;
    }
  }

  // 2. Check if there's a pending request for this key (prevent cache stampede)
  const pendingRequest = pendingRequests.get(key);
  if (pendingRequest) {
    try {
      return await pendingRequest;
    } catch (error) {
      // If pending request fails, continue to fetch
    }
  }

  // 3. Create a promise for this request
  const fetchPromise = (async () => {
    try {
      // 4. Check Redis cache
      const redisValue = await safeRedisGet(key);
      if (redisValue) {
        try {
          const parsed = JSON.parse(redisValue) as T;
          // Store in local cache for hot key handling
          if (useLocalCache) {
            localCache.set(key, parsed, ttl * 1000);
          }
          return parsed;
        } catch (parseError) {
          logger.warn(`Failed to parse cached value for key: ${key}`);
        }
      }

      // 5. Cache miss - fetch from source (database)
      const value = await fetchFn();

      // 6. Store in Redis and local cache
      await safeRedisSet(key, JSON.stringify(value), ttl);
      if (useLocalCache) {
        localCache.set(key, value, ttl * 1000);
      }

      return value;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(key);
    }
  })();

  // Store pending request
  pendingRequests.set(key, fetchPromise);

  return fetchPromise;
}

/**
 * Set value in cache (both Redis and local)
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = 300,
  useLocalCache: boolean = true
): Promise<void> {
  // Store in Redis
  await safeRedisSet(key, JSON.stringify(value), ttl);
  
  // Store in local cache
  if (useLocalCache) {
    localCache.set(key, value, ttl * 1000);
  }
}

/**
 * Delete from cache (both Redis and local)
 */
export async function deleteCached(key: string): Promise<void> {
  await safeRedisDel(key);
  localCache.delete(key);
  pendingRequests.delete(key);
}

/**
 * Invalidate cache pattern (for related keys)
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  // Note: This is a simplified version. In production, you might want to use Redis SCAN
  // For now, we'll just clear local cache entries that match
  for (const key of localCache['cache'].keys()) {
    if (key.includes(pattern)) {
      localCache.delete(key);
      await safeRedisDel(key);
    }
  }
}

/**
 * Key sharding for high-traffic keys
 * Distributes load across multiple Redis keys
 */
export function getShardedKey(baseKey: string, shardCount: number = 10): string {
  // Simple hash-based sharding
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    hash = ((hash << 5) - hash) + baseKey.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const shard = Math.abs(hash) % shardCount;
  return `${baseKey}:shard:${shard}`;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    localCache: localCache.getStats(),
    pendingRequests: pendingRequests.size,
  };
}

export { localCache };


