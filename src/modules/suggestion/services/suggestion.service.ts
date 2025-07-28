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
  private queryStats = new Map<string, { count: number; timestamp: number }>();
  private popularQueries: string[] = [];
  // private cache = new Map<string, string[]>();
  // private words: string[] = [];

  constructor(
    @Inject(suggestionConfig.KEY)
    private readonly config: ConfigType<typeof suggestionConfig>,
    private readonly bkTreeService: BKTreeService,
    private readonly trigramIndexService: TrigramIndexService,
    private readonly trieService: TrieService,
    private readonly levenshteinService: LevenshteinService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    this.logger.log('SuggestionService initialized');
    setInterval(() => this.updatePopularQueries(), 60_000); // Update popular queries every minu
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

    // Warm cache with common words
    await this.warmupCache(words.slice(0, Math.min(1000, words.length)));
  }

  private updatePopularQueries() {
    this.popularQueries = Array.from(this.queryStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 100)
      .map(([query]) => query);

    this.logger.log(
      `Updated popular queries: ${this.popularQueries.length} queries`,
    );
    this.queryStats.clear();
  }

  async warmupCache(queries: string[]): Promise<void> {
    const start = Date.now();
    const batchSize = 50;
    const batchCount = Math.ceil(queries.length / batchSize);

    for (let i = 0; i < batchCount; i++) {
      const batch = queries.slice(i * batchSize, (i + 1) * batchSize);
      await Promise.all(batch.map((query) => this.getSuggestions(query)));
      await new Promise((resolve) => setTimeout(resolve, 10)); // Yield to event loop
    }

    const duration = Date.now() - start;
    this.logger.log(
      `Warmed up cache with ${queries.length} queries in ${duration}ms`,
    );
  }

  /**
   * Get suggestions for a query
   */
  // getSuggestions(query: string): string[] {
  //   const cacheKey = `${query}_${JSON.stringify(this.config)}`;

  //   if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
  //     return this.cache.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
  //   }

  //   const suggestions = this.getMultiStrategySuggestions(query);

  //   // Add size calculation for strings
  //   this.cache.set(SUGGESTION_CACHE, cacheKey, suggestions, {
  //     config: {
  //       maxSize: this.config.cacheSize,
  //       sizeCalculation: (suggestions) =>
  //         suggestions.reduce((sum, s) => sum + s.length, 0),
  //     },
  //   });
  //   return suggestions;
  // }

  getSuggestions(
    query: string,
    configOverride?: Partial<SuggestionConfig>,
  ): string[] {
    const config = { ...this.config, ...configOverride };

    // Track query popularity for cache optimization
    const queryStats = this.queryStats.get(query) || {
      count: 0,
      timestamp: Date.now(),
    };
    this.queryStats.set(query, { ...queryStats, count: queryStats.count + 1 });

    // Skip cache for very short queries
    if (query.length < 3) {
      return this.calculateFresh(query);
    }

    const cacheKey = `${query}_${JSON.stringify(config)}`;

    if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
      return this.cache.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
    }

    const suggestions = this.calculateFresh(query, cacheKey);

    // Calculate cache TTL based on query popularity
    const ttl = this.calculateCacheTTL(query);
    this.cache.set(SUGGESTION_CACHE, cacheKey, suggestions, {
      config: {
        maxSize: config.cacheSize,
        defaultTTL: ttl,
        sizeCalculation: (items: string[]) =>
          items.reduce((sum, item) => sum + item.length * 2, 0), // Approx UTF-16 size
      },
    });

    return suggestions;
  }

  private calculateCacheTTL(query: string): number {
    // Popular queries stay longer in cache
    const isPopular = this.popularQueries.includes(query);
    return isPopular ? 3600_000 : 300_000; // 1 hour vs 5 minutes
  }

  private calculateFresh(query: string, cacheKey: string = ''): string[] {
    const input = query.toLowerCase();
    const adaptiveThreshold = this.getAdaptiveThreshold(input);

    // Strategy 1: Exact prefix match (fastest, highest precision)
    const prefixMatches = this.trieService.getWordsWithPrefix(
      input,
      this.config.maxSuggestions * 2,
    );

    if (prefixMatches.length >= this.config.maxSuggestions) {
      const ttl = this.calculateCacheTTL(query);
      const result = prefixMatches.slice(0, this.config.maxSuggestions);
      if (cacheKey) {
        this.cache.set(SUGGESTION_CACHE, cacheKey, result, {
          config: {
            maxSize: this.config.cacheSize,
            defaultTTL: ttl,
            sizeCalculation: (items: string[]) =>
              items.reduce((sum, item) => sum + item.length * 2, 0), // Approx UTF-16 size
          },
        });
      }
      return result;
    }

    // Strategy 2: BK-Tree search for small edit distances (very fast)
    const candidates = new Set<string>(prefixMatches);
    const bkResults = this.bkTreeService.search(input, adaptiveThreshold);
    bkResults.forEach((word) => candidates.add(word));

    // Strategy 3: Trigram fallback filtering for larger edit distances
    if (candidates.size < this.config.maxTrigramCandidates) {
      const trigramCandidates = this.trigramIndexService.getTopCandidates(
        input,
        this.config.maxTrigramCandidates - candidates.size,
        this.config.minTrigramSimilarity,
      );
      trigramCandidates.forEach((word) => candidates.add(word));
    }

    // Score and rank
    return this.rankCandidates(input, Array.from(candidates));
  }

  // private getMultiStrategySuggestions(query: string): string[] {
  //   const input = query.toLowerCase();
  //   const adaptiveThreshold = this.getAdaptiveThreshold(input);

  //   // Strategy 1: Exact prefix match (fastest, highest precision)
  //   const prefixMatches = this.trieService.getWordsWithPrefix(input);
  //   if (prefixMatches.length >= this.config.maxSuggestions) {
  //     return prefixMatches.slice(0, this.config.maxSuggestions);
  //   }

  //   // Strategy 2: BK-Tree for small edit distances (very fast)
  //   const candidates = new Set<string>();
  //   const bkResults = this.bkTreeService.search(input, adaptiveThreshold);
  //   // const bkResults = this.bkTreeService.search(
  //   //   input,
  //   //   this.config.maxLevenshteinDistance,
  //   // );
  //   bkResults.forEach((word) => candidates.add(word));

  //   // Strategy 3: Trigram filtering for larger edit distances
  //   if (candidates.size < this.config.maxTrigramCandidates) {
  //     const trigramCandidates = this.trigramIndexService.getTopCandidates(
  //       input,
  //       this.config.maxTrigramCandidates - candidates.size,
  //       this.config.minTrigramSimilarity,
  //     );
  //     trigramCandidates.forEach((word) => candidates.add(word));
  //   }

  //   // Score and rank
  //   const scoredCandidates = Array.from(candidates)
  //     .map((word) => ({
  //       word,
  //       score: this.calculateCompositeScore(input, word),
  //     }))
  //     .sort((a, b) => b.score - a.score);

  //   return scoredCandidates
  //     .slice(0, this.config.maxSuggestions)
  //     .map((item) => item.word);
  // }

  private getAdaptiveThreshold(query: string): number {
    // Shorter queries need stricter thresholds
    if (query.length <= 3) return 1;
    if (query.length <= 5) return 2;

    // Dynamically adjust based on query complexity
    const uniqueChars = new Set(query).size;
    const threshold = Math.min(
      this.config.maxLevenshteinDistance,
      Math.floor(query.length / 2) - Math.floor(uniqueChars / 3),
    );

    return Math.max(1, threshold);
  }

  private rankCandidates(query: string, candidates: string[]): string[] {
    return candidates
      .map((candidate) => ({
        candidate,
        score: this.calculateCompositeScore(query, candidate),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxSuggestions)
      .map((item) => item.candidate);
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
  autoTuneOld(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    metricWeight = { precision: 0.6, recall: 0.4 },
  ): SuggestionConfig {
    const configs = this.generateConfigCandidates();
    let bestConfig = this.config;
    let bestScore = 0;

    console.log(`Testing ${configs.length} configuration combinations...`);

    for (const config of configs) {
      // this.config = config;
      this.cache.clear(SUGGESTION_CACHE);

      let totalPrecision = 0;
      let totalRecall = 0;

      for (const testCase of testCases) {
        // Pass the temporary config down instead of setting this.config
        const suggestions = this.getSuggestions(testCase.query, config);
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
    // this.config = bestConfig;
    this.cache.clear(SUGGESTION_CACHE);

    return bestConfig;
  }

  autoTune(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    maxIterations = 50,
    initialTemp = 10.0,
    coolingRate = 0.95,
  ): SuggestionConfig {
    let currentConfig = this.config;
    let currentScore = this.evaluateConfig(testCases);
    let bestConfig = currentConfig;
    let bestScore = currentScore;

    let temperature = initialTemp;
    this.logger.log(
      `Starting auto-tune with initial score: ${currentScore.toFixed(4)}`,
    );

    for (let i = 0; i < maxIterations; i++) {
      const candidateConfig = this.perturbConfig(currentConfig, temperature);
      const candidateScore = this.evaluateConfig(testCases);

      // Always accept better solutions
      const accept =
        candidateScore > currentScore ||
        Math.random() < Math.exp((candidateScore - currentScore) / temperature);

      if (accept) {
        currentConfig = candidateConfig;
        currentScore = candidateScore;

        if (candidateScore > bestScore) {
          bestConfig = candidateConfig;
          bestScore = candidateScore;
          this.logger.log(
            `New best score: ${bestScore.toFixed(4)} at iteration ${i}`,
          );
        }
      }

      // Cool down
      temperature *= coolingRate;
    }

    // this.config = bestConfig;
    this.clearCaches();
    this.logger.log(`Auto-tune complete. Best score: ${bestScore.toFixed(4)}`);
    return bestConfig;
  }

  private perturbConfig(
    config: SuggestionConfig,
    temperature: number,
  ): SuggestionConfig {
    const newConfig = { ...config };
    const perturbationTypes = [
      () =>
        (newConfig.minTrigramSimilarity = this.perturbValue(
          config.minTrigramSimilarity,
          0.1,
          0,
          0.7,
          temperature,
        )),
      () =>
        (newConfig.maxLevenshteinDistance = Math.round(
          this.perturbValue(
            config.maxLevenshteinDistance,
            0.5,
            1,
            5,
            temperature,
          ),
        )),
      () => {
        const newTrigramWeight = this.perturbValue(
          config.trigramWeight,
          0.1,
          0.1,
          0.9,
          temperature,
        );
        newConfig.trigramWeight = newTrigramWeight;
        newConfig.levenshteinWeight = 1 - newTrigramWeight;
      },
    ];

    // Apply random perturbation
    perturbationTypes[Math.floor(Math.random() * perturbationTypes.length)]();
    return newConfig;
  }

  private perturbValue(
    value: number,
    maxDelta: number,
    minVal: number,
    maxVal: number,
    temperature: number,
  ): number {
    const delta = (Math.random() * 2 - 1) * maxDelta * temperature;
    return Math.min(maxVal, Math.max(minVal, value + delta));
  }

  private evaluateConfig(
    // config: SuggestionConfig,
    testCases: Array<{ query: string; expectedResults: string[] }>,
  ): number {
    // const originalConfig = this.config;
    // this.config = config;
    this.clearCaches();

    let totalScore = 0;
    for (const { query, expectedResults } of testCases) {
      const suggestions = this.getSuggestions(query);
      const expectedSet = new Set(expectedResults);
      const suggestionSet = new Set(suggestions);

      // Precision: % of suggestions that are relevant
      const relevant = [...suggestionSet].filter((s) =>
        expectedSet.has(s),
      ).length;
      const precision =
        suggestionSet.size > 0 ? relevant / suggestionSet.size : 0;

      // Recall: % of relevant results found
      const recall = expectedSet.size > 0 ? relevant / expectedSet.size : 0;

      // F1 score: Harmonic mean of precision and recall
      const f1 =
        precision + recall > 0
          ? (2 * (precision * recall)) / (precision + recall)
          : 0;

      totalScore += f1;
    }

    // this.config = originalConfig;
    return totalScore / testCases.length;
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
