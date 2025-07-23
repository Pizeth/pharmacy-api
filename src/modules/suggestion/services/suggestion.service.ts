// src/utils/levenshtein/suggestion.engine.ts
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import {
  LEVENSHTEIN_CACHE,
  SUGGESTION_CACHE,
} from 'src/modules/cache/tokens/cache.tokens';
import suggestionConfig, {
  SuggestionConfig,
} from '../config/suggestion.config';
import { BKTreeService } from './bk-tree/bk-tree.service';
import { LevenshteinService } from './levenshtein/levenshtein.service';
import { TrieService } from './trie/trie.service';
import { TrigramIndexService } from './trigram/trigram-index.service';
import { CacheStats } from 'src/modules/cache/interfaces/caches';

// export class SuggestionService {
//   private trie = new TrieEngine();
//   private unitAliases: string[];
//   private suggestionCache = new Map<string, string[]>();

//   constructor(unitAliases: string[]) {
//     this.unitAliases = unitAliases;
//     this.initializeTrie();
//   }

//   private initializeTrie(): void {
//     for (const alias of this.unitAliases) {
//       this.trie.insert(alias);
//     }
//   }

//   /**
//    * Get typo suggestions using Trie + Levenshtein hybrid strategy
//    */
//   getSuggestions(input: string, maxSuggestions: number = 5): string[] {
//     if (this.suggestionCache.has(input)) {
//       return this.suggestionCache.get(input)!;
//     }

//     // Step 1: Trie-based prefix search
//     const prefixMatches = this.trie.getWordsWithPrefix(input);

//     // Step 2: Filter and rank by Levenshtein distance
//     const scoredMatches = prefixMatches
//       .map((alias) => ({
//         alias,
//         score: LevenshteinUtils.levenshteinDistance(input, alias),
//       }))
//       .sort((a, b) => a.score - b.score);

//     // Step 3: Fallback if insufficient matches
//     if (scoredMatches.length < maxSuggestions) {
//       const additionalSuggestions = this.unitAliases
//         .filter((alias) => !prefixMatches.includes(alias))
//         .map((alias) => ({
//           alias,
//           score: LevenshteinUtils.levenshteinDistance(input, alias),
//         }))
//         .sort((a, b) => a.score - b.score)
//         .slice(0, maxSuggestions - scoredMatches.length);

//       scoredMatches.push(...additionalSuggestions);
//     }

//     const result = scoredMatches
//       .slice(0, maxSuggestions)
//       .map((item) => item.alias);

//     this.suggestionCache.set(input, result);
//     return result;
//   }
// }

@Injectable()
export class SuggestionService implements OnModuleInit {
  private readonly logger = new Logger(SuggestionService.name);
  // private cache = new Map<string, string[]>();
  // private words: string[] = [];

  constructor(
    @Inject(suggestionConfig.KEY)
    private config: ConfigType<typeof suggestionConfig>,
    private readonly bkTreeService: BKTreeService,
    private readonly trigramIndexService: TrigramIndexService,
    private readonly trieService: TrieService,
    private readonly levenshteinService: LevenshteinService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    this.logger.log('SuggestionService initialized');
  }

  /**
   * Initialize the suggestion engine with a vocabulary
   */
  async initialize(words: string[]): Promise<void> {
    this.logger.log(
      `Initializing suggestion engine with ${words.length} words`,
    );

    const start = Date.now();
    // this.words = [...words];

    // Build all indices
    await Promise.all([
      this.bkTreeService.buildTree(words),
      this.trigramIndexService.buildIndex(words),
      this.trieService.buildTrie(words),
    ]);

    const duration = Date.now() - start;
    this.logger.log(`Indices built in ${duration}ms`);
  }

  /**
   * Get suggestions for a query
   */
  getSuggestions(query: string): string[] {
    const cacheKey = `${query}_${JSON.stringify(this.config)}`;

    // if (this.cache.has(cacheKey)) {
    //   return this.cache.get(cacheKey)!;
    // }
    if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
      return this.cache.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
    }

    const suggestions = this.getMultiStrategySuggestions(query);

    // Implement LRU cache
    // if (this.cache.size >= this.config.cacheSize) {
    //   const firstKey = this.cache.keys().next().value;
    //   this.cache.delete(firstKey);
    // }

    // this.cache.set(cacheKey, suggestions);

    this.cache.set(SUGGESTION_CACHE, cacheKey, suggestions, {
      config: { maxSize: this.config.cacheSize },
    });
    return suggestions;
  }

  private getMultiStrategySuggestions(query: string): string[] {
    const input = query.toLowerCase();

    // Strategy 1: Exact prefix match (fastest, highest precision)
    const prefixMatches = this.trieService.getWordsWithPrefix(input);
    if (prefixMatches.length >= this.config.maxSuggestions) {
      return prefixMatches.slice(0, this.config.maxSuggestions);
    }

    // Strategy 2: BK-Tree for small edit distances (very fast)
    const candidates = new Set<string>();
    const bkResults = this.bkTreeService.search(
      input,
      this.config.maxLevenshteinDistance,
    );
    bkResults.forEach((word) => candidates.add(word));

    // Strategy 3: Trigram filtering for larger edit distances
    if (candidates.size < this.config.maxTrigramCandidates) {
      const trigramCandidates = this.trigramIndexService.getTopCandidates(
        input,
        this.config.maxTrigramCandidates - candidates.size,
        this.config.minTrigramSimilarity,
      );
      trigramCandidates.forEach((word) => candidates.add(word));
    }

    // Score and rank
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

  private calculateCompositeScore(query: string, candidate: string): number {
    // Trigram similarity (0-1, higher is better)
    const trigramSim = this.trigramIndexService.calculateSimilarity(
      query,
      candidate,
    );

    // Levenshtein distance (normalized to 0-1, higher is better)
    const maxLen = Math.max(query.length, candidate.length);
    const levDistance = this.levenshteinService.calculateDistance(
      query,
      candidate,
    );
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
   * Benchmark the suggestion engine
   */
  benchmark(testQueries: string[]): void {
    if (!this.config.enableBenchmarking) {
      this.logger.warn('Benchmarking is disabled in configuration');
      return;
    }

    // this.logger.log('Benchmarking suggestion strategies...');

    // const strategies = [
    //   {
    //     name: 'Trie Only',
    //     fn: (q: string) => this.trieService.getWordsWithPrefix(q),
    //   },
    //   {
    //     name: 'BK-Tree Only',
    //     fn: (q: string) => this.bkTreeService.search(q, 2),
    //   },
    //   {
    //     name: 'Trigram Only',
    //     fn: (q: string) => this.trigramIndexService.getTopCandidates(q, 10),
    //   },
    //   {
    //     name: 'Multi-Strategy',
    //     fn: (q: string) => this.getMultiStrategySuggestions(q),
    //   },
    // ];

    // for (const strategy of strategies) {
    //   const start = performance.now();

    //   for (const query of testQueries) {
    //     strategy.fn(query.toLowerCase());
    //   }

    //   const end = performance.now();
    //   const avgTime = (end - start) / testQueries.length;
    //   console.log(`${strategy.name}: ${avgTime.toFixed(3)}ms per query`);
    // }

    this.logger.log('Starting benchmark...');

    const start = Date.now();
    for (const query of testQueries) {
      this.getSuggestions(query);
    }
    const end = Date.now();

    const avgTime = (end - start) / testQueries.length;
    this.logger.log(`Average query time: ${avgTime.toFixed(2)}ms`);
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
      this.cache.clear(SUGGESTION_CACHE);

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
    this.cache.clear(SUGGESTION_CACHE);

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
            cacheSize: this.config.cacheSize,
            enableBenchmarking: this.config.enableBenchmarking,
          });
        }
      }
    }

    return configs;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    // this.levenshteinService.clearCache();
    this.cache.clear(SUGGESTION_CACHE);
    this.cache.clear(LEVENSHTEIN_CACHE);
    this.logger.log('All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    stat: CacheStats<unknown>;
    maxSize: number;
  } {
    return {
      stat: this.cache.stats(SUGGESTION_CACHE),
      maxSize: this.config.cacheSize,
    };
  }
}

// export class OptimizedSuggestionEngine {
//   private bkTree: BKTree;
//   private trigramIndex: TrigramIndex;
//   private trie: TrieEngine;
//   private words: string[];
//   private maxSize: number;
//   // private cache = new Map<string, string[]>();

//   private config: SuggestionConfig = {
//     minTrigramSimilarity: 0.3,
//     maxTrigramCandidates: 50,
//     maxLevenshteinDistance: 3,
//     maxSuggestions: 5,
//     trigramWeight: 0.3,
//     levenshteinWeight: 0.7,
//   };

//   constructor(
//     words: string[],
//     private readonly cacheService: CacheService,
//     config?: Partial<SuggestionConfig>,
//     maxSize: number = 500,
//   ) {
//     this.words = words;
//     this.maxSize = maxSize;
//     this.config = { ...this.config, ...config };

//     console.time('Building indices');
//     this.bkTree = new BKTree(words);
//     this.trigramIndex = new TrigramIndex(words);
//     this.trie = new TrieEngine();
//     words.forEach((word) => this.trie.insert(word));
//     console.timeEnd('Building indices');
//   }

//   /**
//    * Multi-strategy suggestion system
//    */
//   getSuggestions(query: string): string[] {
//     const cacheKey = `${query}_${JSON.stringify(this.config)}`;
//     // if (this.cache.has(cacheKey)) {
//     //   return this.cache.get(cacheKey)!;
//     // }
//     if (this.cacheService.has(SUGGESTION_CACHE, cacheKey)) {
//       return this.cacheService.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
//     }

//     const suggestions = this.getMultiStrategySuggestions(query);
//     // this.cache.set(cacheKey, suggestions);
//     this.cacheService.set(SUGGESTION_CACHE, cacheKey, suggestions, {
//       config: { maxSize: this.maxSize },
//     });
//     return suggestions;
//   }

//   private getMultiStrategySuggestions(query: string): string[] {
//     const input = query.toLowerCase();

//     // Strategy 1: Exact prefix match (fastest, highest precision)
//     const prefixMatches = this.trie.getWordsWithPrefix(input);
//     if (prefixMatches.length >= this.config.maxSuggestions) {
//       return prefixMatches.slice(0, this.config.maxSuggestions);
//     }

//     // Strategy 2: BK-Tree for small edit distances (very fast)
//     const candidates = new Set<string>();
//     const bkResults = this.bkTree.search(
//       input,
//       this.config.maxLevenshteinDistance,
//     );
//     bkResults.forEach((word) => candidates.add(word));

//     // Strategy 3: Trigram filtering for larger edit distances
//     if (candidates.size < this.config.maxTrigramCandidates) {
//       const trigramCandidates = this.trigramIndex.getTopCandidates(
//         input,
//         this.config.maxTrigramCandidates - candidates.size,
//         this.config.minTrigramSimilarity,
//       );
//       trigramCandidates.forEach((word) => candidates.add(word));
//     }

//     // Score and rank all candidates
//     const scoredCandidates = Array.from(candidates)
//       .map((word) => ({
//         word,
//         score: this.calculateCompositeScore(input, word),
//       }))
//       .sort((a, b) => b.score - a.score);

//     return scoredCandidates
//       .slice(0, this.config.maxSuggestions)
//       .map((item) => item.word);
//   }

//   /**
//    * Composite scoring combining multiple similarity metrics
//    */
//   private calculateCompositeScore(query: string, candidate: string): number {
//     // Trigram similarity (0-1, higher is better)
//     const trigramSim = this.trigramIndex.calculateSimilarity(query, candidate);

//     // Levenshtein distance (normalized to 0-1, higher is better)
//     const maxLen = Math.max(query.length, candidate.length);
//     const levDistance = LevenshteinUtils.levenshteinDistance(query, candidate);
//     const levSim = maxLen === 0 ? 1 : 1 - levDistance / maxLen;

//     // Length penalty (prefer similar-length words)
//     const lengthDiff = Math.abs(query.length - candidate.length);
//     const lengthPenalty =
//       1 - lengthDiff / Math.max(query.length, candidate.length);

//     // Weighted composite score
//     return (
//       this.config.trigramWeight * trigramSim +
//       this.config.levenshteinWeight * levSim +
//       0.1 * lengthPenalty // Small bonus for similar length
//     );
//   }

//   /**
//    * Benchmark different strategies
//    */
//   benchmark(testQueries: string[]): void {
//     console.log('Benchmarking suggestion strategies...');

//     const strategies = [
//       { name: 'Trie Only', fn: (q: string) => this.trie.getWordsWithPrefix(q) },
//       { name: 'BK-Tree Only', fn: (q: string) => this.bkTree.search(q, 2) },
//       {
//         name: 'Trigram Only',
//         fn: (q: string) => this.trigramIndex.getTopCandidates(q, 10),
//       },
//       {
//         name: 'Multi-Strategy',
//         fn: (q: string) => this.getMultiStrategySuggestions(q),
//       },
//     ];

//     for (const strategy of strategies) {
//       const start = performance.now();

//       for (const query of testQueries) {
//         strategy.fn(query.toLowerCase());
//       }

//       const end = performance.now();
//       const avgTime = (end - start) / testQueries.length;
//       console.log(`${strategy.name}: ${avgTime.toFixed(3)}ms per query`);
//     }
//   }

//   /**
//    * Tune thresholds based on a test dataset
//    */
//   autoTune(
//     testCases: Array<{ query: string; expectedResults: string[] }>,
//     metricWeight = { precision: 0.6, recall: 0.4 },
//   ): SuggestionConfig {
//     const configs = this.generateConfigCandidates();
//     let bestConfig = this.config;
//     let bestScore = 0;

//     console.log(`Testing ${configs.length} configuration combinations...`);

//     for (const config of configs) {
//       this.config = config;
//       this.cache.clear();

//       let totalPrecision = 0;
//       let totalRecall = 0;

//       for (const testCase of testCases) {
//         const suggestions = this.getSuggestions(testCase.query);
//         const expected = new Set(testCase.expectedResults);
//         const suggested = new Set(suggestions);

//         const intersection = new Set(
//           [...suggested].filter((x) => expected.has(x)),
//         );

//         const precision =
//           suggested.size === 0 ? 0 : intersection.size / suggested.size;
//         const recall =
//           expected.size === 0 ? 1 : intersection.size / expected.size;

//         totalPrecision += precision;
//         totalRecall += recall;
//       }

//       const avgPrecision = totalPrecision / testCases.length;
//       const avgRecall = totalRecall / testCases.length;
//       const fScore =
//         metricWeight.precision * avgPrecision + metricWeight.recall * avgRecall;

//       if (fScore > bestScore) {
//         bestScore = fScore;
//         bestConfig = { ...config };
//       }
//     }

//     console.log(
//       `Best configuration found with score ${bestScore.toFixed(3)}:`,
//       bestConfig,
//     );
//     this.config = bestConfig;
//     this.cache.clear();

//     return bestConfig;
//   }

//   private generateConfigCandidates(): SuggestionConfig[] {
//     const configs: SuggestionConfig[] = [];

//     // Grid search over key parameters
//     const trigramThresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
//     const maxDistances = [1, 2, 3, 4];
//     const weightCombinations = [
//       { trigram: 0.2, levenshtein: 0.8 },
//       { trigram: 0.3, levenshtein: 0.7 },
//       { trigram: 0.4, levenshtein: 0.6 },
//       { trigram: 0.5, levenshtein: 0.5 },
//     ];

//     for (const threshold of trigramThresholds) {
//       for (const maxDist of maxDistances) {
//         for (const weights of weightCombinations) {
//           configs.push({
//             minTrigramSimilarity: threshold,
//             maxTrigramCandidates: 50,
//             maxLevenshteinDistance: maxDist,
//             maxSuggestions: 5,
//             trigramWeight: weights.trigram,
//             levenshteinWeight: weights.levenshtein,
//           });
//         }
//       }
//     }

//     return configs;
//   }
// }
