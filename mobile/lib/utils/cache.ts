import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const PREFIX = '@cache:';

export const cache = {
  /**
   * Store data with a TTL in milliseconds.
   * Default TTL: 5 minutes.
   */
  async set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // Cache write failure is non-critical; ignore silently
    }
  },

  /**
   * Get cached data. Returns null if not found or expired.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  /**
   * Delete a specific cached key.
   */
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },

  /**
   * Fetch from cache; if expired/missing, call fetcher and cache result.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 5 * 60 * 1000,
  ): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await cache.set(key, fresh, ttlMs);
    return fresh;
  },

  /**
   * Clear all keys matching a prefix pattern.
   * e.g. clear('nft:') → clears all nft cache entries
   */
  async clearPrefix(prefix: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const toDelete = allKeys.filter(k => k.startsWith(PREFIX + prefix));
      if (toDelete.length) await AsyncStorage.multiRemove(toDelete);
    } catch {}
  },
};
