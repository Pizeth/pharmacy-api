/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  AdvancedCacheWrapper,
  CacheWrapper,
  CacheStats,
  CacheOptions,
  CacheProvider,
  DefaultCacheConfig,
  CacheEntry,
  CacheMetadata,
  CacheHealthReport,
  InspectResult,
} from '../interfaces/caches';
import { EnhancedCache } from './enhanced-cache';

// Centralized Cache Manager with enhanced features
export class CentralizedCacheManager {
  private static instance: CentralizedCacheManager;

  // The map now stores functions, not cache instances. It's safer.
  private providers = new Map<string, CacheProvider<any, any>>();
  private readonly caches = new Map<string, CacheEntry>();
  private readonly defaultConfig: DefaultCacheConfig;
  // private caches = new Map<string, AdvancedCacheWrapper<any, any>>();
  // private defaultConfig: CacheOptions<any, any>;

  // private constructor(defaultConfig: CacheOptions<any, any> = { max: 100 }) {
  //   this.defaultConfig = defaultConfig;
  // }

  private constructor(
    defaultConfig: DefaultCacheConfig = {
      max: 100,
      useLibrary: true,
    },
  ) {
    this.defaultConfig = { ...defaultConfig };
  }

  // Singleton pattern
  // public static getInstance(
  //   defaultConfig?: CacheOptions<any, any>,
  // ): CentralizedCacheManager {
  //   if (!CentralizedCacheManager.instance) {
  //     CentralizedCacheManager.instance = new CentralizedCacheManager(
  //       defaultConfig,
  //     );
  //   }
  //   return CentralizedCacheManager.instance;
  // }

  // Singleton pattern with proper typing
  public static getInstance(
    defaultConfig?: DefaultCacheConfig,
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
  // public getCache<K extends {}, V extends {}>(
  //   cacheName: string,
  //   config?: Partial<CacheOptions<K, V>>,
  // ): CacheWrapper<K, V> {
  //   // Return the existing instance if it's already created
  //   if (this.caches.has(cacheName)) {
  //     return this.caches.get(cacheName)! as AdvancedCacheWrapper<K, V>;
  //   }

  //   // Get the registered provider function for this cache name
  //   const provider = this.providers.get(cacheName);
  //   if (!provider) {
  //     throw new Error(
  //       `No cache provider registered for "${cacheName}". Please register it first.`,
  //     );
  //   }

  //   // Create the final config by merging defaults and overrides
  //   const cacheConfig = { ...this.defaultConfig, ...config };

  //   // Call the provider function to create the new cache instance
  //   const cache = provider(cacheConfig);
  //   this.caches.set(cacheName, cache);
  //   return cache;

  //   // const cacheConfig = { ...this.defaultConfig, ...config };
  //   // const cache = new EnhancedCache<K, V>(cacheConfig);
  //   // this.caches.set(cacheName, cache);
  //   // return cache;
  // }

  // Type-safe cache retrieval with proper generic constraints
  public getCache<K extends {}, V extends {}>(
    cacheName: string,
    config?: Partial<CacheOptions<K, V>>,
  ): CacheWrapper<K, V> {
    const existingEntry = this.caches.get(cacheName);

    if (existingEntry) {
      // Update last accessed time
      existingEntry.lastAccessed = new Date();
      // Type assertion is safe here because we control the cache creation
      return existingEntry.cache as CacheWrapper<K, V>;
    }

    // Merge configurations with proper typing
    const mergedConfig: CacheOptions<K, V> = {
      ...this.defaultConfig,
      ...config,
    } as CacheOptions<K, V>;

    const cache = new EnhancedCache<K, V>(mergedConfig);

    // Store cache entry with metadata
    const cacheEntry: CacheEntry = {
      cache: cache as AdvancedCacheWrapper<unknown, unknown>,
      config: mergedConfig as CacheOptions<unknown, unknown>,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.caches.set(cacheName, cacheEntry);
    return cache;
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

  // public clearCache(cacheName: string): void {
  //   const cache = this.caches.get(cacheName);
  //   if (cache) {
  //     cache.clear();
  //   }
  // }

  public clearCache(cacheName: string): void {
    const cacheEntry = this.caches.get(cacheName);
    if (cacheEntry) {
      cacheEntry.cache.clear();
    }
  }

  // public clearAllCaches(): void {
  //   this.caches.forEach((cache) => cache.clear());
  // }

  public clearAllCaches(): void {
    this.caches.forEach((entry) => entry.cache.clear());
  }

  // Enhanced cache statistics
  // public getCacheStats<K>(
  //   cacheName: string,
  // ): (CacheStats<K> & { exists: boolean }) | null {
  //   const cache = this.caches.get(cacheName);
  //   if (!cache) {
  //     return {
  //       hits: 0,
  //       misses: 0,
  //       size: 0,
  //       itemCount: 0,
  //       keys: [].values(), // Provide an empty iterator for keys
  //       hitRate: 0,
  //       exists: false,
  //     };
  //   }

  //   return {
  //     ...cache.stats(),
  //     exists: true,
  //   };
  // }

  // Enhanced cache statistics with proper typing
  public getCacheStats<K = unknown>(
    cacheName: string,
  ): (CacheStats<K> & { exists: boolean }) | null {
    const cacheEntry = this.caches.get(cacheName);

    if (!cacheEntry) {
      return {
        hits: 0,
        misses: 0,
        size: 0,
        itemCount: 0,
        keys: [].values() as IterableIterator<K>,
        hitRate: 0,
        exists: false,
      };
    }

    const stats = cacheEntry.cache.stats() as CacheStats<K>;
    return {
      ...stats,
      exists: true,
    };
  }

  // Get aggregated statistics for all caches
  // public getAllCacheStats<K, V>(): Record<string, CacheStats<K>> {
  //   const allStats: Record<string, CacheStats<K>> = {};
  //   this.caches.forEach((cache: AdvancedCacheWrapper<K, V>, name) => {
  //     allStats[name] = cache.stats();
  //   });
  //   return allStats;
  // }

  // Get aggregated statistics with improved typing
  public getAllCacheStats(): Record<
    string,
    CacheStats<unknown> & {
      createdAt: Date;
      lastAccessed: Date;
      config: Partial<CacheOptions<unknown, unknown>>;
    }
  > {
    const allStats: Record<
      string,
      CacheStats<unknown> & {
        createdAt: Date;
        lastAccessed: Date;
        config: Partial<CacheOptions<unknown, unknown>>;
      }
    > = {};

    this.caches.forEach((entry, name) => {
      const stats = entry.cache.stats();
      allStats[name] = {
        ...stats,
        createdAt: entry.createdAt,
        lastAccessed: entry.lastAccessed,
        config: entry.config,
      };
    });

    return allStats;
  }

  // Enhanced cache metadata retrieval
  public getCacheMetadata(cacheName: string): CacheMetadata {
    const entry = this.caches.get(cacheName);

    if (!entry) {
      return { exists: false };
    }

    return {
      exists: true,
      createdAt: entry.createdAt,
      lastAccessed: entry.lastAccessed,
      config: entry.config,
    };
  }

  // Batch operations with type safety
  public batchSet<K extends {}, V extends {}>(
    cacheName: string,
    entries: Array<{ key: K; value: V; ttl?: number }>,
  ): void {
    const cache = this.getCache<K, V>(cacheName);

    for (const { key, value, ttl } of entries) {
      cache.set(key, value, ttl ? { ttl } : undefined);
    }
  }

  public batchGet<K extends {}, V extends {}>(
    cacheName: string,
    keys: K[],
  ): Map<K, V | undefined> {
    const cache = this.getCache<K, V>(cacheName);
    const results = new Map<K, V | undefined>();

    for (const key of keys) {
      results.set(key, cache.get(key));
    }

    return results;
  }

  public batchDelete<K extends {}>(
    cacheName: string,
    keys: K[],
  ): Map<K, boolean> {
    const cache = this.getCache<K, {}>(cacheName);
    const results = new Map<K, boolean>();

    for (const key of keys) {
      results.set(key, cache.delete(key));
    }

    return results;
  }

  // // Prune all caches
  // public pruneAllCaches(): void {
  //   this.caches.forEach((cache) => cache.purgeStale());
  // }

  // Prune operations
  public pruneAllCaches(): void {
    this.caches.forEach((entry) => entry.cache.purgeStale());
  }

  // Prune specific cache
  // public pruneCache(cacheName: string): void {
  //   const cache = this.caches.get(cacheName);
  //   if (cache) {
  //     cache.purgeStale();
  //   }
  // }

  public pruneCache(cacheName: string): void {
    const entry = this.caches.get(cacheName);
    if (entry) {
      entry.cache.purgeStale();
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
  // public removeCache<K, V>(cacheName: string): boolean {
  //   const cache = this.caches.get(cacheName) as AdvancedCacheWrapper<K, V>;
  //   if (cache) {
  //     cache.dispose(); // Clean up any timers
  //     cache.clear();
  //     return this.caches.delete(cacheName);
  //   }
  //   return false;
  // }

  public removeCache(cacheName: string): boolean {
    const entry = this.caches.get(cacheName);

    if (entry) {
      entry.cache.dispose(); // Clean up any timers
      entry.cache.clear(); // Release memory
      return this.caches.delete(cacheName);
    }

    return false;
  }

  // Enhanced cache inspection
  public inspectCache<K extends {}, V extends {}>(
    cacheName: string,
  ): InspectResult {
    const entry = this.caches.get(cacheName);

    if (!entry) {
      return { exists: false };
    }

    const cache = entry.cache as CacheWrapper<K, V>;
    const stats = entry.cache.stats() as CacheStats<K>;

    return {
      exists: true,
      keys: Array.from(cache.keys()),
      size: cache.size,
      config: entry.config as Partial<CacheOptions<K, V>>,
      stats,
    };
  }

  // Conditional operations with type safety
  public getOrSet<K extends {}, V extends {}>(
    cacheName: string,
    key: K,
    factory: () => V | Promise<V>,
    options?: { ttl?: number; config?: Partial<CacheOptions<K, V>> },
  ): V | Promise<V> {
    const cache = this.getCache<K, V>(cacheName, options?.config);
    const existing = cache.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const value = factory();

    // Handle both sync and async factories
    if (value instanceof Promise) {
      return value.then((resolvedValue) => {
        cache.set(
          key,
          resolvedValue,
          options?.ttl ? { ttl: options.ttl } : undefined,
        );
        return resolvedValue;
      });
    } else {
      cache.set(key, value, options?.ttl ? { ttl: options.ttl } : undefined);
      return value;
    }
  }

  // Memory optimization - remove unused caches
  public cleanupUnusedCaches(maxIdleTime: number = 3600000): number {
    // 1 hour default
    const now = new Date();
    let cleanedCount = 0;

    for (const [name, entry] of this.caches.entries()) {
      const idleTime = now.getTime() - entry.lastAccessed.getTime();

      if (idleTime > maxIdleTime && entry.cache.size === 0) {
        entry.cache.dispose();
        this.caches.delete(name);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Clean up all caches (useful for graceful shutdown)
  // public dispose(): void {
  //   this.caches.forEach((cache) => {
  //     cache.dispose();
  //     cache.clear();
  //   });
  //   this.caches.clear();
  // }

  // Graceful shutdown with proper cleanup
  public dispose(): void {
    this.caches.forEach((entry) => {
      entry.cache.dispose();
      entry.cache.clear();
    });
    this.caches.clear();
  }

  // Health check method
  public getHealthStatus(): CacheHealthReport {
    const cacheEntries = Array.from(this.caches.entries());
    const now = new Date();

    let totalItems = 0;
    let totalSize = 0;
    let totalHits = 0;
    let totalRequests = 0;
    let oldestCache: { name: string; age: number } | undefined;
    let largestCache: { name: string; size: number } | undefined;

    for (const [name, entry] of cacheEntries) {
      const stats = entry.cache.stats();
      totalItems += stats.itemCount;
      totalSize += stats.size;
      totalHits += stats.hits;
      totalRequests += stats.hits + stats.misses;

      const age = now.getTime() - entry.createdAt.getTime();
      if (!oldestCache || age > oldestCache.age) {
        oldestCache = { name, age };
      }

      if (!largestCache || stats.size > largestCache.size) {
        largestCache = { name, size: stats.size };
      }
    }

    return {
      totalCaches: cacheEntries.length,
      totalItems,
      totalSize,
      averageHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestCache,
      largestCache,
    };
  }
}
