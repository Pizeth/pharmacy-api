import { CacheOptions, CacheWrapper } from 'src/types/cache';

// Centralized Cache Manager with enhanced features
export class CentralizedCacheManager {
  private static instance: CentralizedCacheManager;
  private caches = new Map<string, CacheWrapper<any, any>>();
  private defaultConfig: CacheOptions<any, any>;

  private constructor(defaultConfig: CacheOptions<any, any> = { max: 100 }) {
    this.defaultConfig = defaultConfig;
  }

  // Singleton pattern
  public static getInstance(
    defaultConfig?: CacheOptions<any, any>,
  ): CentralizedCacheManager {
    if (!CentralizedCacheManager.instance) {
      CentralizedCacheManager.instance = new CentralizedCacheManager(
        defaultConfig,
      );
    }
    return CentralizedCacheManager.instance;
  }

  // Get or create a cache instance
  public getCache<K, V>(
    cacheName: string,
    config?: Partial<CacheOptions<K, V>>,
  ): CacheWrapper<K, V> {
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName)!;
    }

    const cacheConfig = { ...this.defaultConfig, ...config };
    const cache = new EnhancedCache<K, V>(cacheConfig);
    this.caches.set(cacheName, cache);
    return cache;
  }

  // Enhanced utility methods
  public addToCache<K, V>(
    cacheName: string,
    key: K,
    value: V,
    opts?: { ttl?: number },
  ): void {
    const cache = this.getCache<K, V>(cacheName);
    cache.set(key, value, opts);
  }

  public getFromCache<K, V>(cacheName: string, key: K): V | undefined {
    const cache = this.getCache<K, V>(cacheName);
    return cache.get(key);
  }

  public hasInCache<K, V>(cacheName: string, key: K): boolean {
    const cache = this.getCache<K, V>(cacheName);
    return cache.has(key);
  }

  public removeFromCache<K, V>(cacheName: string, key: K): boolean {
    const cache = this.getCache<K, V>(cacheName);
    return cache.delete(key);
  }

  public clearCache(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
    }
  }

  public clearAllCaches(): void {
    this.caches.forEach((cache) => cache.clear());
  }

  // Enhanced cache statistics
  public getCacheStats(
    cacheName: string,
  ): (CacheStats & { exists: boolean }) | null {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return {
        hits: 0,
        misses: 0,
        size: 0,
        itemCount: 0,
        keys: [],
        hitRate: 0,
        exists: false,
      };
    }
    return {
      ...cache.stats(),
      exists: true,
    };
  }

  // Get aggregated statistics for all caches
  public getAllCacheStats(): Record<string, CacheStats> {
    const allStats: Record<string, CacheStats> = {};
    this.caches.forEach((cache, name) => {
      allStats[name] = cache.stats();
    });
    return allStats;
  }

  // Prune all caches
  public pruneAllCaches(): void {
    this.caches.forEach((cache) => cache.prune());
  }

  // Prune specific cache
  public pruneCache(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.prune();
    }
  }

  // Get cache names
  public getCacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  // Remove cache instance with proper cleanup
  public removeCache(cacheName: string): boolean {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.dispose(); // Clean up any timers
      cache.clear();
      return this.caches.delete(cacheName);
    }
    return false;
  }

  // Clean up all caches (useful for graceful shutdown)
  public dispose(): void {
    this.caches.forEach((cache) => {
      cache.dispose();
      cache.clear();
    });
    this.caches.clear();
  }
}
