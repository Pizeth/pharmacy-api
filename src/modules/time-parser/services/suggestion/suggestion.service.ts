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

  // Precompute trigrams for all aliases
  // const aliasTrigrams = new Map<string, Set<string>>();
  // for (const alias of Object.keys(UNIT_ALIASES)) {
  //   const trigrams = this.getTrigrams(alias);
  //   aliasTrigrams.set(alias, trigrams);
  // }

  // Function to get trigrams of a string
  private getTrigrams(str: string): Set<string> {
    const trigrams = new Set<string>();
    for (let i = 0; i < str.length - 2; i++) {
      trigrams.add(str.slice(i, i + 3));
    }
    return trigrams;
  }

  // Function to compute trigram similarity
  private trigramSimilarity(input: string, alias: string): number {
    const inputTrigrams = this.getTrigrams(input);
    const aliasTrigrams = aliasTrigrams.get(alias)!;
    let matches = 0;
    for (const trigram of inputTrigrams) {
      if (aliasTrigrams.has(trigram)) matches++;
    }
    return matches / Math.max(inputTrigrams.size, aliasTrigrams.size);
  }

  // In getSuggestionsForUnit, use trigram similarity
  private getSuggestionsForUnit(input: string): string[] {
    const aliases = Object.keys(UNIT_ALIASES);
    return aliases
      .map((alias) => ({
        alias,
        similarity: this.trigramSimilarity(input, alias),
      }))
      .filter((item) => item.similarity > 0.5) // Adjust threshold as needed
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((item) => item.alias);
  }
}
