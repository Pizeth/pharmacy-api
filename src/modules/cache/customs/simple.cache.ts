import { CacheStats, CacheWrapper } from '../interfaces/caches';

export class SimpleCache<K, V> implements CacheWrapper<K, V> {
  private store = new Map<K, { value: V; expiresAt?: number }>();
  constructor(private defaultTTL?: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, opts?: { ttl?: number }): void {
    const ttl = opts?.ttl ?? this.defaultTTL;
    const expiresAt = ttl != null ? Date.now() + ttl : undefined;
    this.store.set(key, { value, expiresAt });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt != null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }

  keys(): IterableIterator<K> {
    return this.store.keys();
  }

  purgeStale(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt != null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
  dispose(): void {
    throw new Error('Method not implemented.');
  }
  stats(): CacheStats<K> {
    throw new Error('Method not implemented.');
  }
}
