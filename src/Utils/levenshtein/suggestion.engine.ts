// src/utils/levenshtein/suggestion.engine.ts
import { TrieEngine } from './trie.engine';
import { LevenshteinUtils } from './levenshtein.utils';

export class SuggestionEngine {
  private trie = new TrieEngine();
  private unitAliases: string[];
  private suggestionCache = new Map<string, string[]>();

  constructor(unitAliases: string[]) {
    this.unitAliases = unitAliases;
    this.initializeTrie();
  }

  private initializeTrie(): void {
    for (const alias of this.unitAliases) {
      this.trie.insert(alias);
    }
  }

  /**
   * Get typo suggestions using Trie + Levenshtein hybrid strategy
   */
  getSuggestions(input: string, maxSuggestions: number = 5): string[] {
    if (this.suggestionCache.has(input)) {
      return this.suggestionCache.get(input)!;
    }

    // Step 1: Trie-based prefix search
    const prefixMatches = this.trie.getWordsWithPrefix(input);

    // Step 2: Filter and rank by Levenshtein distance
    const scoredMatches = prefixMatches
      .map((alias) => ({
        alias,
        score: LevenshteinUtils.levenshteinDistance(input, alias),
      }))
      .sort((a, b) => a.score - b.score);

    // Step 3: Fallback if insufficient matches
    if (scoredMatches.length < maxSuggestions) {
      const additionalSuggestions = this.unitAliases
        .filter((alias) => !prefixMatches.includes(alias))
        .map((alias) => ({
          alias,
          score: LevenshteinUtils.levenshteinDistance(input, alias),
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, maxSuggestions - scoredMatches.length);

      scoredMatches.push(...additionalSuggestions);
    }

    const result = scoredMatches
      .slice(0, maxSuggestions)
      .map((item) => item.alias);

    this.suggestionCache.set(input, result);
    return result;
  }
}
