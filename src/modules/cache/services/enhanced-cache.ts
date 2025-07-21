/* eslint-disable @typescript-eslint/no-empty-object-type */
import { LRUCache } from 'lru-cache';
import { SimpleCache } from '../customs/simple.cache';
import {
  AdvancedCacheWrapper,
  CacheWrapper,
  CacheOptions,
  LRUCacheOptions,
  CacheStats,
} from '../interfaces/caches';

// Enhanced cache implementation
export class EnhancedCache<K extends {}, V extends {}>
  implements AdvancedCacheWrapper<K, V>
{
  private readonly cache: CacheWrapper<K, V>;
  private hits = 0;
  private misses = 0;
  private pruneTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions<K, V>) {
    // Destructure all properties needed for logic
    const {
      defaultTTL,
      maxSize,
      sizeCalculation,
      max,
      backgroundPruneInterval,
      useLibrary, // Ignored
      // The rest operator collects all other valid pass-through LRUCache options
      ...lruOpts
    } = options;

    if (useLibrary) {
      // Library-backed LRU
      const baseConfig = {
        ...lruOpts,
        updateAgeOnGet: true,
        updateAgeOnHas: false,
      };
      // Logic correctly builds a valid options object in a type-safe way
      const finalOptions: LRUCacheOptions<K, V> =
        defaultTTL != null
          ? {
              ...baseConfig,
              ttl: defaultTTL,
              ttlAutopurge: true,
              // Optionally include other limits if they are also provided.
              ...(max != null && { max }),
              ...(maxSize != null &&
                sizeCalculation != null && { maxSize, sizeCalculation }),
            }
          : maxSize != null
            ? {
                ...baseConfig,
                maxSize,
                // `sizeCalculation` is only valid with `maxSize`.
                ...(sizeCalculation != null && { sizeCalculation }),
                ...(max != null && { max }),
              }
            : {
                ...baseConfig,
                max: max != null ? max : 1000,
              };

      this.cache = new LRUCache<K, V>(finalOptions);
    } else {
      if (maxSize || sizeCalculation) {
        throw new Error(
          'Map fallback does not support maxSize or sizeCalculation',
        );
      }
      this.cache = new SimpleCache<K, V>(defaultTTL);
    }

    if (backgroundPruneInterval != null) {
      this.pruneTimer = setInterval(
        () => this.cache.purgeStale(),
        backgroundPruneInterval,
      );
    }
  }

  get(key: K): V | undefined {
    const v = this.cache.get(key);
    if (v === undefined) {
      this.misses++;
    } else {
      this.hits++;
    }
    return v;
  }

  set(key: K, value: V, opts?: { ttl?: number }): void {
    if (opts?.ttl != null) {
      // per‐item ttl override
      this.cache.set(key, value, { ttl: opts.ttl });
    } else {
      this.cache.set(key, value);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove all items from the cache, and reset the hit and miss counters.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Manually trigger a cache purge of expired items.
   *
   * Call this method to immediately remove all expired items from the cache.
   * This is not necessary unless you have disabled the automatic pruning that
   * occurs every {@link backgroundPruneInterval} milliseconds.
   */
  purgeStale(): void {
    this.cache.purgeStale();
  }

  dispose(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  stats(): CacheStats<K> {
    const itemCount = this.cache.size;
    const size = this.cache.calculatedSize ?? itemCount;
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size,
      itemCount,
      // keys: Array.from(this.cache.keys()),
      keys: this.keys(),
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Returns the number of items in the cache.
   *
   * @returns the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }
}
