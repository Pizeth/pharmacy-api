import { LRUCacheOptions } from 'lru-cache';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number; // current total size or item count
  itemCount: number; // number of entries
  keys: string[]; // current keys in LRU order (newest→oldest)
  hitRate: number; // hits / (hits + misses)
}

export interface CacheOptions<K, V> extends Omit<LRUCacheOptions<K, V>, 'ttl'> {
  /**
   * Default TTL (ms) for every entry unless overridden in `set()`.
   */
  defaultTTL?: number;

  /**
   * Maximum aggregate size of all entries. Works only if
   * you also supply `sizeCalculation`.
   */
  maxSize?: number;

  /**
   * Calculator fn that returns the “weight” of a single item.
   * Combined with `maxSize` to evict by total weight.
   */
  sizeCalculation?: (value: V, key: K) => number;

  /**
   * If given, calls `cache.prune()` every `interval` ms
   * to purge stale entries in the background.
   */
  backgroundPruneInterval?: number;
}

// Interface for cache configuration
export interface CacheConfig {
  maxSize: number;
  ttl?: number; // Time to live in milliseconds
  useLibrary?: boolean; // Whether to use lru-cache library or custom implementation
}

// Cache wrapper interface for consistency
export interface CacheWrapper<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, opts?: { ttl?: number }): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  prune(): void;
  dispose(): void;
  stats(): CacheStats;
  size: number;
}

// NestJS Injectable decorator support
export interface CacheModuleOptions {
  defaultConfig?: EnhancedCacheOptions<any, any>;
  isGlobal?: boolean;
}
