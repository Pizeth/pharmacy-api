/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CacheOptions, CacheStats } from 'src/types/cache';

@Injectable()
export class LRUCacheService<K = string, V = unknown> {
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
