// src/utils/levenshtein/trie.engine.ts
import { CacheService } from 'src/modules/cache/services/cache.service';
// import { BKTree } from './bk-tree.service';
import { SuggestionConfig } from '../../interfaces/config';
// import { LevenshteinUtils } from '../levenshtein/levenshtein.service';
// import { TrieNode } from './trie-node';
// import { TrigramIndex } from '../trigram/trigram-index.service';
import { SUGGESTION_CACHE } from 'src/modules/cache/tokens/cache.tokens';
import { Injectable } from '@nestjs/common';
import { TrieNode } from '../../nodes/node.class';

export class TrieEngine {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
  }

  /**
   * Get all words in the trie that start with the given prefix
   */
  getWordsWithPrefix(prefix: string): string[] {
    const results: string[] = [];
    const prefixLower = prefix.toLowerCase();
    let node = this.root;

    for (const char of prefixLower) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }

    this.collectWords(node, prefixLower, results);
    return results;
  }

  private collectWords(
    node: TrieNode,
    current: string,
    results: string[],
  ): void {
    if (node.isEndOfWord) results.push(current);
    for (const [char, child] of node.children.entries()) {
      this.collectWords(child, current + char, results);
    }
  }
}

@Injectable()
export class TrieService {
  private root = new TrieNode();

  buildTrie(words: string[]): void {
    this.root = new TrieNode();

    for (const word of words) {
      this.insert(word.toLowerCase());
    }
  }

  private insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
  }

  getWordsWithPrefix(prefix: string): string[] {
    const results: string[] = [];
    const prefixLower = prefix.toLowerCase();
    let node = this.root;

    for (const char of prefixLower) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }

    this.collectWords(node, prefixLower, results);
    return results;
  }

  private collectWords(
    node: TrieNode,
    current: string,
    results: string[],
  ): void {
    if (node.isEndOfWord) results.push(current);
    for (const [char, child] of node.children.entries()) {
      this.collectWords(child, current + char, results);
    }
  }
}

export class OptimizedSuggestionEngine {
  private bkTree: BKTree;
  private trigramIndex: TrigramIndex;
  private trie: TrieEngine;
  private words: string[];
  private maxSize: number;
  // private cache = new Map<string, string[]>();

  private config: SuggestionConfig = {
    minTrigramSimilarity: 0.3,
    maxTrigramCandidates: 50,
    maxLevenshteinDistance: 3,
    maxSuggestions: 5,
    trigramWeight: 0.3,
    levenshteinWeight: 0.7,
  };

  constructor(
    words: string[],
    private readonly cacheService: CacheService,
    config?: Partial<SuggestionConfig>,
    maxSize: number = 500,
  ) {
    this.words = words;
    this.maxSize = maxSize;
    this.config = { ...this.config, ...config };

    console.time('Building indices');
    this.bkTree = new BKTree(words);
    this.trigramIndex = new TrigramIndex(words);
    this.trie = new TrieEngine();
    words.forEach((word) => this.trie.insert(word));
    console.timeEnd('Building indices');
  }

  /**
   * Multi-strategy suggestion system
   */
  getSuggestions(query: string): string[] {
    const cacheKey = `${query}_${JSON.stringify(this.config)}`;
    // if (this.cache.has(cacheKey)) {
    //   return this.cache.get(cacheKey)!;
    // }
    if (this.cacheService.has(SUGGESTION_CACHE, cacheKey)) {
      return this.cacheService.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
    }

    const suggestions = this.getMultiStrategySuggestions(query);
    // this.cache.set(cacheKey, suggestions);
    this.cacheService.set(SUGGESTION_CACHE, cacheKey, suggestions, {
      config: { maxSize: this.maxSize },
    });
    return suggestions;
  }

  private getMultiStrategySuggestions(query: string): string[] {
    const input = query.toLowerCase();

    // Strategy 1: Exact prefix match (fastest, highest precision)
    const prefixMatches = this.trie.getWordsWithPrefix(input);
    if (prefixMatches.length >= this.config.maxSuggestions) {
      return prefixMatches.slice(0, this.config.maxSuggestions);
    }

    // Strategy 2: BK-Tree for small edit distances (very fast)
    const candidates = new Set<string>();
    const bkResults = this.bkTree.search(
      input,
      this.config.maxLevenshteinDistance,
    );
    bkResults.forEach((word) => candidates.add(word));

    // Strategy 3: Trigram filtering for larger edit distances
    if (candidates.size < this.config.maxTrigramCandidates) {
      const trigramCandidates = this.trigramIndex.getTopCandidates(
        input,
        this.config.maxTrigramCandidates - candidates.size,
        this.config.minTrigramSimilarity,
      );
      trigramCandidates.forEach((word) => candidates.add(word));
    }

    // Score and rank all candidates
    const scoredCandidates = Array.from(candidates)
      .map((word) => ({
        word,
        score: this.calculateCompositeScore(input, word),
      }))
      .sort((a, b) => b.score - a.score);

    return scoredCandidates
      .slice(0, this.config.maxSuggestions)
      .map((item) => item.word);
  }

  /**
   * Composite scoring combining multiple similarity metrics
   */
  private calculateCompositeScore(query: string, candidate: string): number {
    // Trigram similarity (0-1, higher is better)
    const trigramSim = this.trigramIndex.calculateSimilarity(query, candidate);

    // Levenshtein distance (normalized to 0-1, higher is better)
    const maxLen = Math.max(query.length, candidate.length);
    const levDistance = LevenshteinUtils.levenshteinDistance(query, candidate);
    const levSim = maxLen === 0 ? 1 : 1 - levDistance / maxLen;

    // Length penalty (prefer similar-length words)
    const lengthDiff = Math.abs(query.length - candidate.length);
    const lengthPenalty =
      1 - lengthDiff / Math.max(query.length, candidate.length);

    // Weighted composite score
    return (
      this.config.trigramWeight * trigramSim +
      this.config.levenshteinWeight * levSim +
      0.1 * lengthPenalty // Small bonus for similar length
    );
  }

  /**
   * Benchmark different strategies
   */
  benchmark(testQueries: string[]): void {
    console.log('Benchmarking suggestion strategies...');

    const strategies = [
      { name: 'Trie Only', fn: (q: string) => this.trie.getWordsWithPrefix(q) },
      { name: 'BK-Tree Only', fn: (q: string) => this.bkTree.search(q, 2) },
      {
        name: 'Trigram Only',
        fn: (q: string) => this.trigramIndex.getTopCandidates(q, 10),
      },
      {
        name: 'Multi-Strategy',
        fn: (q: string) => this.getMultiStrategySuggestions(q),
      },
    ];

    for (const strategy of strategies) {
      const start = performance.now();

      for (const query of testQueries) {
        strategy.fn(query.toLowerCase());
      }

      const end = performance.now();
      const avgTime = (end - start) / testQueries.length;
      console.log(`${strategy.name}: ${avgTime.toFixed(3)}ms per query`);
    }
  }

  /**
   * Tune thresholds based on a test dataset
   */
  autoTune(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    metricWeight = { precision: 0.6, recall: 0.4 },
  ): SuggestionConfig {
    const configs = this.generateConfigCandidates();
    let bestConfig = this.config;
    let bestScore = 0;

    console.log(`Testing ${configs.length} configuration combinations...`);

    for (const config of configs) {
      this.config = config;
      this.cache.clear();

      let totalPrecision = 0;
      let totalRecall = 0;

      for (const testCase of testCases) {
        const suggestions = this.getSuggestions(testCase.query);
        const expected = new Set(testCase.expectedResults);
        const suggested = new Set(suggestions);

        const intersection = new Set(
          [...suggested].filter((x) => expected.has(x)),
        );

        const precision =
          suggested.size === 0 ? 0 : intersection.size / suggested.size;
        const recall =
          expected.size === 0 ? 1 : intersection.size / expected.size;

        totalPrecision += precision;
        totalRecall += recall;
      }

      const avgPrecision = totalPrecision / testCases.length;
      const avgRecall = totalRecall / testCases.length;
      const fScore =
        metricWeight.precision * avgPrecision + metricWeight.recall * avgRecall;

      if (fScore > bestScore) {
        bestScore = fScore;
        bestConfig = { ...config };
      }
    }

    console.log(
      `Best configuration found with score ${bestScore.toFixed(3)}:`,
      bestConfig,
    );
    this.config = bestConfig;
    this.cache.clear();

    return bestConfig;
  }

  private generateConfigCandidates(): SuggestionConfig[] {
    const configs: SuggestionConfig[] = [];

    // Grid search over key parameters
    const trigramThresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
    const maxDistances = [1, 2, 3, 4];
    const weightCombinations = [
      { trigram: 0.2, levenshtein: 0.8 },
      { trigram: 0.3, levenshtein: 0.7 },
      { trigram: 0.4, levenshtein: 0.6 },
      { trigram: 0.5, levenshtein: 0.5 },
    ];

    for (const threshold of trigramThresholds) {
      for (const maxDist of maxDistances) {
        for (const weights of weightCombinations) {
          configs.push({
            minTrigramSimilarity: threshold,
            maxTrigramCandidates: 50,
            maxLevenshteinDistance: maxDist,
            maxSuggestions: 5,
            trigramWeight: weights.trigram,
            levenshteinWeight: weights.levenshtein,
          });
        }
      }
    }

    return configs;
  }
}
