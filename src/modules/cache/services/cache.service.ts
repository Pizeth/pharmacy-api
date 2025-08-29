/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheOptions } from '../interfaces/caches';
import { CentralizedCacheManager } from './centralized-cache-manager.service';
import cacheConfig from '../configs/cache.config';
import { ConfigType } from '@nestjs/config';

// Type-safe cache service with enhanced functionality
@Injectable()
export class CacheService {
  private readonly cacheManager: CentralizedCacheManager;
  private readonly context = CacheService.name;
  private readonly logger = new Logger(this.context);

  constructor(
    // defaultConfig?: CacheOptions<string, unknown>,
    @Inject(cacheConfig.KEY)
    private readonly config: ConfigType<typeof cacheConfig>,
  ) {
    this.cacheManager = CentralizedCacheManager.getInstance(this.config);
    console.log('[BOOT] CacheService constructor');
    // this.logger.debug('CacheService initialized with config:', this.config);
  }

  // onModuleInit() {
  //   this.cacheManager = CentralizedCacheManager.getInstance(this.config);
  // }

  // Enhanced function caching with proper type inference
  public async cacheFunction<T extends {}>(
    cacheName: string,
    key: string,
    fn: () => Promise<T> | T,
    options?: {
      ttl?: number;
      config?: Partial<CacheOptions<string, T>>;
    },
  ): Promise<T> {
    return this.cacheManager.getOrSet(
      cacheName,
      key,
      fn,
      options,
    ) as Promise<T>;
  }

  // Synchronous function caching
  public cacheFunctionSync<T extends {}>(
    cacheName: string,
    key: string,
    fn: () => T,
    options?: {
      ttl?: number;
      config?: Partial<CacheOptions<string, T>>;
    },
  ): T {
    return this.cacheManager.getOrSet(cacheName, key, fn, options) as T;
  }

  // Type-safe direct cache operations
  public set<T extends {}>(
    cacheName: string,
    key: string,
    value: T,
    options?: {
      ttl?: number;
      config?: Partial<CacheOptions<string, T>>;
    },
  ): void {
    this.cacheManager.addToCache(cacheName, key, value, { ttl: options?.ttl });
  }

  public get<T extends {}>(cacheName: string, key: string): T | undefined {
    return this.cacheManager.getFromCache<string, T>(cacheName, key);
  }

  public has(cacheName: string, key: string): boolean {
    return this.cacheManager.hasInCache(cacheName, key);
  }

  public delete(cacheName: string, key: string): boolean {
    return this.cacheManager.removeFromCache(cacheName, key);
  }

  // Batch operations with type safety
  public batchSet<T extends {}>(
    cacheName: string,
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): void {
    this.cacheManager.batchSet(cacheName, entries);
  }

  public batchGet<T extends {}>(
    cacheName: string,
    keys: string[],
  ): Map<string, T | undefined> {
    return this.cacheManager.batchGet<string, T>(cacheName, keys);
  }

  public batchDelete(cacheName: string, keys: string[]): Map<string, boolean> {
    return this.cacheManager.batchDelete(cacheName, keys);
  }

  // Cache management operations
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

  // Enhanced statistics and inspection
  public stats(cacheName: string) {
    return this.cacheManager.getCacheStats(cacheName);
  }

  public getAllStats() {
    return this.cacheManager.getAllCacheStats();
  }

  public inspect<T extends {}>(cacheName: string) {
    return this.cacheManager.inspectCache<string, T>(cacheName);
  }

  public getMetadata(cacheName: string) {
    return this.cacheManager.getCacheMetadata(cacheName);
  }

  public getAllCacheNames(): readonly string[] {
    return this.cacheManager.getCacheNames();
  }

  // Health and maintenance
  public getHealthStatus() {
    return this.cacheManager.getHealthStatus();
  }

  public cleanupUnused(maxIdleTime?: number): number {
    return this.cacheManager.cleanupUnusedCaches(maxIdleTime);
  }

  // Graceful shutdown
  public dispose(): void {
    this.cacheManager.dispose();
  }

  // Advanced patterns for common use cases

  // Memoization decorator support
  public memoize<TArgs extends readonly unknown[], TReturn extends {}>(
    cacheName: string,
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    options?: {
      keyGenerator?: (...args: TArgs) => string;
      ttl?: number;
    },
  ): (...args: TArgs) => TReturn | Promise<TReturn> {
    const keyGenerator =
      options?.keyGenerator ?? ((...args) => JSON.stringify(args));

    return (...args: TArgs) => {
      const key = keyGenerator(...args);

      const result = fn(...args);

      if (result instanceof Promise) {
        return this.cacheFunction(cacheName, key, () => result, {
          ttl: options?.ttl,
        });
      } else {
        return this.cacheFunctionSync(cacheName, key, () => result, {
          ttl: options?.ttl,
        });
      }
    };
  }

  // Cache warming utilities
  public async warmCache<T extends {}>(
    cacheName: string,
    entries: Array<{
      key: string;
      factory: () => T | Promise<T>;
      ttl?: number;
    }>,
  ): Promise<Map<string, { success: boolean; error?: Error }>> {
    const results = new Map<string, { success: boolean; error?: Error }>();

    await Promise.allSettled(
      entries.map(async ({ key, factory, ttl }) => {
        try {
          const value = await factory();
          this.set(cacheName, key, value, { ttl });
          results.set(key, { success: true });
        } catch (error) {
          results.set(key, {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }),
    );

    return results;
  }

  // Cache invalidation patterns
  public invalidatePattern(
    cacheName: string,
    pattern: RegExp | ((key: string) => boolean),
  ): number {
    const inspection = this.inspect(cacheName);
    if (!inspection.exists || !inspection.keys) {
      return 0;
    }

    const matcher =
      pattern instanceof RegExp ? (key: string) => pattern.test(key) : pattern;

    let invalidatedCount = 0;

    for (const key of inspection.keys) {
      if (matcher(String(key))) {
        if (this.delete(cacheName, String(key))) {
          invalidatedCount++;
        }
      }
    }

    return invalidatedCount;
  }

  // Conditional operations
  public setIfNotExists<T extends {}>(
    cacheName: string,
    key: string,
    value: T,
    options?: { ttl?: number },
  ): boolean {
    if (!this.has(cacheName, key)) {
      this.set(cacheName, key, value, options);
      return true;
    }
    return false;
  }

  public getAndRefresh<T extends {}>(
    cacheName: string,
    key: string,
    ttl: number,
  ): T | undefined {
    const value = this.get<T>(cacheName, key);
    if (value !== undefined) {
      // Refresh the TTL
      this.set(cacheName, key, value, { ttl });
    }
    return value;
  }
}
