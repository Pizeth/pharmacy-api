/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CacheConfig, CacheOptions, CacheStats } from 'src/types/cache';

@Injectable()
export class LRUCacheService<K extends {} = string, V = unknown> {
  // private readonly cache: LRUCache<string, T>;
  private readonly cache: LRUCache<K, V>;
  private hits = 0;
  private misses = 0;
  private pruneTimer?: NodeJS.Timeout;

  // constructor(maxSize: number = 100) {
  //   this.cache = new LRUCache<string, T>({
  //     max: maxSize,
  //   });
  // }

  constructor(options: CacheOptions<K, V>) {
    // extract our extras, pass the rest straight through
    const {
      defaultTTL,
      maxSize,
      sizeCalculation,
      backgroundPruneInterval,
      ...lruOpts
    } = options;

    this.cache = new LRUCache<K, V>({
      // TTL for each entry (ms)
      ttl: defaultTTL,
      // size-based eviction
      maxSize,
      sizeCalculation,
      // propagate any other lru-cache options
      ...lruOpts,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });

    // if requested, start a background prune loop
    if (backgroundPruneInterval != null) {
      this.pruneTimer = setInterval(
        () => this.cache.prune(),
        backgroundPruneInterval,
      );
    }
  }

  // get(key: string): T | undefined {
  //   return this.cache.get(key);
  // }

  // set(key: string, value: T): void {
  //   this.cache.set(key, value);
  // }

  // delete(key: string): void {
  //   this.cache.delete(key);
  // }

  // clear(): void {
  //   this.cache.clear();
  // }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  keys(): string[] {
    return [...this.cache.keys()];
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Get a cached value. Increments hit or miss counter.
   */
  get(key: K): V | undefined {
    const val = this.cache.get(key);
    if (val === undefined) {
      this.misses++;
    } else {
      this.hits++;
    }
    return val;
  }

  /**
   * Set a value. Optionally override the per-item TTL.
   *
   * @param key
   * @param value
   * @param ttl ms before this entry expires; if omitted, falls back to defaultTTL
   */
  // set(key: K, value: V, ttl?: number): void {
  //   if (ttl != null) {
  //     // per‐item ttl override
  //     this.cache.set(key, value, { ttl });
  //   } else {
  //     // use global default TTL
  //     this.cache.set(key, value);
  //   }
  // }

  /**
   * Store a value. You can override per-item TTL by passing `opts.ttl`.
   */
  /**
   * Set a value. Optionally override the per-item TTL.
   *
   * @param key
   * @param value
   * @param ttl ms before this entry expires; if omitted, falls back to defaultTTL
   */
  set(key: K, value: V, opts?: { ttl?: number }): void {
    if (opts?.ttl != null) {
      // per‐item ttl override
      this.cache.set(key, value, { ttl: opts.ttl });
    } else {
      // use global default TTL
      this.cache.set(key, value);
    }
  }

  /**
   * Delete an entry (manually evict).
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove everything.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Force-purge expired entries immediately */
  prune(): void {
    this.cache.prune();
  }

  /** Dispose background timer if any */
  dispose(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
  }

  /** Read‐only snapshot of current statistics */
  stats(): CacheStats {
    const itemCount = this.cache.size; // number of entries
    const size = (this.cache as any).calculatedSize ?? itemCount;
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size,
      itemCount,
      keys: Array.from(this.cache.keys()),
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
  // set<T>(cache: LRUCache<string, T>, key: string, value: T): void {
  //   cache.set(key, value);
  // }
  private addToCache<T extends {}>(
    cache: LRUCache<string, T>,
    key: string,
    value: T,
  ): void {
    cache.set(key, value);
  }
}

// Cache wrapper interface
interface CacheWrapper<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size: number;
}

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
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName)!;
    }

    const cacheConfig = { ...this.defaultConfig, ...config };
    const cache = this.createCache<K, V>(cacheConfig);
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

// Convenience class for easier usage
export class CacheService {
  private cacheManager: CentralizedCacheManager;

  constructor(defaultConfig?: CacheConfig) {
    this.cacheManager = CentralizedCacheManager.getInstance(defaultConfig);
  }

  // Cache with automatic key generation
  public async cacheFunction<T>(
    cacheName: string,
    key: string,
    fn: () => Promise<T> | T,
    config?: Partial<CacheConfig>,
  ): Promise<T> {
    const cache = this.cacheManager.getCache<string, T>(cacheName, config);

    // Check if value exists in cache
    const cachedValue = cache.get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    // Execute function and cache result
    const result = await fn();
    cache.set(key, result);
    return result;
  }

  // Direct cache access methods
  public set<T>(
    cacheName: string,
    key: string,
    value: T,
    config?: Partial<CacheConfig>,
  ): void {
    this.cacheManager.addToCache(cacheName, key, value);
  }

  public get<T>(
    cacheName: string,
    key: string,
    config?: Partial<CacheConfig>,
  ): T | undefined {
    return this.cacheManager.getFromCache<string, T>(cacheName, key);
  }

  public has(cacheName: string, key: string): boolean {
    return this.cacheManager.hasInCache(cacheName, key);
  }

  public delete(cacheName: string, key: string): boolean {
    return this.cacheManager.removeFromCache(cacheName, key);
  }

  public clear(cacheName: string): void {
    this.cacheManager.clearCache(cacheName);
  }

  public clearAll(): void {
    this.cacheManager.clearAllCaches();
  }

  public stats(cacheName: string) {
    return this.cacheManager.getCacheStats(cacheName);
  }

  public getAllCacheNames(): string[] {
    return this.cacheManager.getCacheNames();
  }
}
