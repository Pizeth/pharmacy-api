/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { LRUCache } from 'lru-cache';

export interface CacheStats<K> {
  hits: number;
  misses: number;
  size: number; // current total size or item count
  itemCount: number; // number of entries
  keys: IterableIterator<K>; // current keys in LRU order (newest→oldest)
  hitRate: number; // hits / (hits + misses)
}

type LRUCacheOptions<K, V> = LRUCache.Options<K, V, unknown>;
export interface CacheOptions<K, V>
  extends Omit<LRUCache.OptionsBase<K, V, unknown>, 'ttl'> {
  /**
   * Default TTL (ms) for every entry unless overridden in `set()`.
   */
  defaultTTL?: number;

  /**
   * If given, calls `cache.prune()` every `interval` ms
   * to purge stale entries in the background.
   */
  backgroundPruneInterval?: number;

  /**
   * Option to choose whether to use lru-cache library or custom implementation
   */
  useLibrary?: boolean;
}

// Interface for cache configuration
export interface CacheConfig {
  maxSize: number;
  ttl?: number; // Time to live in milliseconds
  useLibrary: true; // Whether to use lru-cache library or custom implementation
}

// Cache wrapper interface for consistency and LRU-Cache compartible
export interface CacheWrapper<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, opts?: { ttl?: number }): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  purgeStale(): void;
  // info(key: K): LRUCache.Entry<V> | undefined;
  keys(): IterableIterator<K>;
  // Require Properties
  readonly size: number;
  readonly calculatedSize?: number;
}

// Extra cache methods for advanced usage
export interface AdvancedCacheWrapper<K, V> extends CacheWrapper<K, V> {
  dispose(): void;
  stats(): CacheStats<K>;
}

// NestJS Injectable decorator support
export interface CacheModuleOptions {
  defaultConfig?: CacheOptions<any, any>;
  isGlobal?: boolean;
}

// A type for a function that knows how to create a specific cache instance.
// This is the key to the type-safe pattern.
type CacheProvider<K extends {}, V extends {}> = (
  config?: Partial<CacheOptions<K, V>>,
) => AdvancedCacheWrapper<K, V>;
