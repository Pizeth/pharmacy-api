import { CacheConfig, CacheWrapper } from 'src/types/cache';

// Centralized Cache Manager
export class CentralizedCacheManager {
  private static instance: CentralizedCacheManager;
  private caches = new Map<string, CacheWrapper<any, any>>();
  private defaultConfig: CacheConfig;

  private constructor(defaultConfig: CacheConfig = { maxSize: 100 }) {
    this.defaultConfig = defaultConfig;
  }

  // Singleton pattern
  public static getInstance(
    defaultConfig?: CacheConfig,
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
    config?: Partial<CacheConfig>,
  ): CacheWrapper<K, V> {
    // let cache = this.caches.get(cacheName);
    // if (!cache) {
    //   cache = this.createCache<K, V>({
    //     ...this.defaultConfig,
    //     ...config,
    //   });
    //   this.caches.set(cacheName, cache);
    // }
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName)!;
    }

    const cacheConfig = { ...this.defaultConfig, ...config };
    const cache = this.createCache<K, V>(cacheConfig);
    this.caches.set(cacheName, cache);
    return cache;
  }

  // Get or create a cache instance
  public getCache<K, V>(
    cacheName: string,
    config?: Partial<EnhancedCacheOptions<K, V>>,
  ): CacheWrapper<K, V> {
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName)!;
    }

    const cacheConfig = { ...this.defaultConfig, ...config };
    const cache = new EnhancedCache<K, V>(cacheConfig);
    this.caches.set(cacheName, cache);
    return cache;
  }

  // Create cache instance based on configuration
  private createCache<K, V>(config: CacheConfig): CacheWrapper<K, V> {
    if (config.useLibrary) {
      // Use lru-cache library
      const lruCache = new LRUCache<K, V>({
        max: config.maxSize,
        ttl: config.ttl,
      });

      return {
        get: (key: K) => lruCache.get(key),
        set: (key: K, value: V) => lruCache.set(key, value),
        has: (key: K) => lruCache.has(key),
        delete: (key: K) => lruCache.delete(key),
        clear: () => lruCache.clear(),
        get size() {
          return lruCache.size;
        },
      };
    } else {
      // Use custom implementation
      const customCache = new CustomLRUCache<K, V>(config.maxSize);

      return {
        get: (key: K) => customCache.get(key),
        set: (key: K, value: V) => customCache.set(key, value),
        has: (key: K) => customCache.has(key),
        delete: (key: K) => customCache.delete(key),
        clear: () => customCache.clear(),
        get size() {
          return customCache.size;
        },
      };
    }
  }

  // Utility methods for cache management
  public addToCache<K, V>(cacheName: string, key: K, value: V): void {
    const cache = this.getCache<K, V>(cacheName);
    cache.set(key, value);
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

  // Get cache statistics
  public getCacheStats(cacheName: string): { size: number; exists: boolean } {
    const cache = this.caches.get(cacheName);
    return {
      size: cache ? cache.size : 0,
      exists: !!cache,
    };
  }

  // Get all cache names
  public getCacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  // Remove cache instance
  public removeCache(cacheName: string): boolean {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
      return this.caches.delete(cacheName);
    }
    return false;
  }
}
