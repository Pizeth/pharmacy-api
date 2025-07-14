import { Injectable } from '@nestjs/common';
import e from 'express';
import { LRUCache } from 'lru-cache';

@Injectable()
export class LRUCacheService<K extends object, V extends object> {
  private readonly cache = new LRUCache<K, V>({
    max: 5,
  });
  //   private readonly maxSize: number;

  //   constructor(maxSize: number = 100) {
  //     this.maxSize = maxSize;
  //   }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  //   set(key: K, value: V): void {
  //     if (this.cache.size >= this.maxSize) {
  //       const firstKey = this.cache.keys().next().value;
  //       this.cache.delete(firstKey);
  //     }
  //     this.cache.set(key, value);
  //   }

  set<K>(cache: LRUCache<string, K>, key: string, value: K): void {
    cache.set(key, value);
  }
}
