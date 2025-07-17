import { LRUCache } from 'lru-cache';
import { CacheOptions, CacheWrapper } from 'src/types/cache';

// Enhanced cache implementation
export class EnhancedCache<K = string, V = unknown>
  implements CacheWrapper<K, V>
{
  private readonly cache: LRUCache<K, V>;
  private hits = 0;
  private misses = 0;
  private pruneTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions<K, V>) {
    const {
      defaultTTL,
      maxSize,
      sizeCalculation,
      backgroundPruneInterval,
      ...lruOpts
    } = options;

    this.cache = new LRUCache<K, V>({
      ttl: defaultTTL,
      maxSize,
      sizeCalculation,
      ...lruOpts,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });

    if (backgroundPruneInterval != null) {
      this.pruneTimer = setInterval(
        () => this.cache.prune(),
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

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  prune(): void {
    this.cache.prune();
  }

  dispose(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
  }

  stats(): CacheStats {
    const itemCount = this.cache.size;
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

  get size(): number {
    return this.cache.size;
  }
}
