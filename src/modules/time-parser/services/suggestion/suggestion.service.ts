// src/modules/time-parser/services/suggestion.service.ts
import { Injectable } from '@nestjs/common';
import { UNIT_ALIASES } from 'src/types/time';

/**
 * Service to compute and cache fuzzy suggestions for mistyped units.
 */
@Injectable()
export class SuggestionService {
  private readonly maxCache = 500;
  private suggestionCache = new Map<string, string[]>();

  /**
   * Returns up to 5 closest unit aliases to the input.
   */
  suggest(input: string): string[] {
    // Check if suggestion already cached

    const key = input.toLowerCase();
    if (this.suggestionCache.has(key)) {
      return this.suggestionCache.get(key)!;
    }

    // compute distances
    const aliases = Object.keys(UNIT_ALIASES);
    const scored = aliases.map((alias) => ({
      alias,
      // Calculate Levenshtein distance for similarity scoring
      score: this.levenshtein(input, alias),
    }));
    scored.sort((a, b) => a.score - b.score);

    // Take the top 5 suggestions
    const suggestions = scored.slice(0, 5).map((item) => item.alias);

    // Add the suggestion to cache to improve performance
    this.cache(this.suggestionCache, key, suggestions);
    return suggestions;
  }

  /** Simple Levenshtein distance with threshold cutoff. */
  private levenshtein(a: string, b: string, threshold = 5): number {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (Math.abs(m - n) > threshold) return threshold + 1;

    const row = Array(n + 1)
      .fill(0)
      .map((_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = i;
      for (let j = 1; j <= n; j++) {
        const cur = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
        prev = cur;
      }
    }
    const dist = row[n];
    return dist > threshold ? threshold + 1 : dist;
  }

  /** LRU‑style cache eviction. */
  private cache<T>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= this.maxCache) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    cache.set(key, value);
  }
}
