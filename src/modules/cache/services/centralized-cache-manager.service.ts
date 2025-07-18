/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  AdvancedCacheWrapper,
  CacheOptions,
  CacheProvider,
  CacheStats,
  CacheWrapper,
} from 'src/types/cache';

// Centralized Cache Manager with enhanced features
export class CentralizedCacheManager {
  private static instance: CentralizedCacheManager;

  // The map now stores functions, not cache instances. It's safer.
  private providers = new Map<string, CacheProvider<any, any>>();
  private caches = new Map<string, AdvancedCacheWrapper<any, any>>();
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

  /**
   * Registers a factory function for a specific cache.
   * This is done once at application startup.
   * @param cacheName The unique name for the cache.
   * @param provider A function that creates and returns a new EnhancedCache with specific types.
   */
  public registerCache<K extends {}, V extends {}>(
    cacheName: string,
    provider: CacheProvider<K, V>,
  ): void {
    if (this.providers.has(cacheName)) {
      console.warn(`Cache provider for "${cacheName}" is being overwritten.`);
    }
    this.providers.set(cacheName, provider);
  }

  // Get or create a cache instance
  public getCache<K extends {}, V extends {}>(
    cacheName: string,
    config?: Partial<CacheOptions<K, V>>,
  ): CacheWrapper<K, V> {
    // Return the existing instance if it's already created
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName)! as AdvancedCacheWrapper<K, V>;
    }

    // Get the registered provider function for this cache name
    const provider = this.providers.get(cacheName);
    if (!provider) {
      throw new Error(
        `No cache provider registered for "${cacheName}". Please register it first.`,
      );
    }

    // Create the final config by merging defaults and overrides
    const cacheConfig = { ...this.defaultConfig, ...config };

    // Call the provider function to create the new cache instance
    const cache = provider(cacheConfig);
    this.caches.set(cacheName, cache);
    return cache;

    // const cacheConfig = { ...this.defaultConfig, ...config };
    // const cache = new EnhancedCache<K, V>(cacheConfig);
    // this.caches.set(cacheName, cache);
    // return cache;
  }

  // Enhanced utility methods
  public addToCache<K extends {}, V extends {}>(
    cacheName: string,
    key: K,
    value: V,
    opts?: { ttl?: number },
  ): void {
    const cache = this.getCache<K, V>(cacheName);
    cache.set(key, value, opts);
  }

  public getFromCache<K extends {}, V extends {}>(
    cacheName: string,
    key: K,
  ): V | undefined {
    const cache = this.getCache<K, V>(cacheName);
    return cache.get(key);
  }

  public hasInCache<K extends {}, V extends {}>(
    cacheName: string,
    key: K,
  ): boolean {
    const cache = this.getCache<K, V>(cacheName);
    return cache.has(key);
  }

  public removeFromCache<K extends {}, V extends {}>(
    cacheName: string,
    key: K,
  ): boolean {
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
  public getCacheStats<K>(
    cacheName: string,
  ): (CacheStats<K> & { exists: boolean }) | null {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return {
        hits: 0,
        misses: 0,
        size: 0,
        itemCount: 0,
        keys: [].values(), // Provide an empty iterator for keys
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
  public getAllCacheStats<K, V>(): Record<string, CacheStats<K>> {
    const allStats: Record<string, CacheStats<K>> = {};
    this.caches.forEach((cache: AdvancedCacheWrapper<K, V>, name) => {
      allStats[name] = cache.stats();
    });
    return allStats;
  }

  // Prune all caches
  public pruneAllCaches(): void {
    this.caches.forEach((cache) => cache.purgeStale());
  }

  // Prune specific cache
  public pruneCache(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.purgeStale();
    }
  }

  public getCacheNames(): string[] {
    return Array.from(this.providers.keys());
  }

  // Get cache names
  // public getCacheNames(): string[] {
  //   return Array.from(this.caches.keys());
  // }

  // Remove cache instance with proper cleanup
  public removeCache<K, V>(cacheName: string): boolean {
    const cache = this.caches.get(cacheName) as AdvancedCacheWrapper<K, V>;
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
