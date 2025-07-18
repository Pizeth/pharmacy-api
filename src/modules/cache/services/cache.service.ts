/* eslint-disable @typescript-eslint/no-empty-object-type */
import { CacheOptions } from 'src/types/cache';
import { CentralizedCacheManager } from './centralized-cache-manager.service';

// Enhanced Cache Service for easier usage
export class CacheService {
  private cacheManager: CentralizedCacheManager;

  constructor(defaultConfig?: CacheOptions<any, any>) {
    this.cacheManager = CentralizedCacheManager.getInstance(defaultConfig);
  }

  // Cache function with automatic key generation and TTL support
  public async cacheFunction<T extends {}>(
    cacheName: string,
    key: string,
    fn: () => Promise<T> | T,
    options?: {
      config?: Partial<CacheOptions<string, T>>;
      ttl?: number;
    },
  ): Promise<T> {
    const cache = this.cacheManager.getCache<string, T>(
      cacheName,
      options?.config,
    );

    const cachedValue = cache.get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    // Execute function and cache result
    const result = await fn();
    cache.set(key, result, { ttl: options?.ttl });
    return result;
  }

  // Enhanced direct cache access methods
  public set<T extends {}>(
    cacheName: string,
    key: string,
    value: T,
    options?: {
      config?: Partial<CacheOptions<string, T>>;
      ttl?: number;
    },
  ): void {
    this.cacheManager.addToCache(cacheName, key, value, { ttl: options?.ttl });
  }

  public get<T extends {}>(
    cacheName: string,
    key: string,
    config?: Partial<CacheOptions<string, T>>,
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

  public prune(cacheName: string): void {
    this.cacheManager.pruneCache(cacheName);
  }

  public pruneAll(): void {
    this.cacheManager.pruneAllCaches();
  }

  public stats(cacheName: string) {
    return this.cacheManager.getCacheStats(cacheName);
  }

  public getAllStats() {
    return this.cacheManager.getAllCacheStats();
  }

  public getAllCacheNames(): string[] {
    return this.cacheManager.getCacheNames();
  }

  // Graceful shutdown support
  public dispose(): void {
    this.cacheManager.dispose();
  }
}
