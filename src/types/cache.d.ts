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
