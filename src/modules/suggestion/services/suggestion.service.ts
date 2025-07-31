// src/utils/levenshtein/suggestion.engine.ts
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import {
  LEVENSHTEIN_CACHE,
  SUGGESTION_CACHE,
} from 'src/modules/cache/tokens/cache.tokens';
import suggestionConfig from '../config/suggestion.config';
import { BKTreeService } from './bk-tree/bk-tree.service';
import { LevenshteinService } from './levenshtein/levenshtein.service';
import { TrieService } from './trie/trie.service';
import { TrigramIndexService } from './trigram/trigram-index.service';
import { CacheStats } from 'src/modules/cache/interfaces/caches';
import {
  AdvancedBenchmarkResult,
  AutoTuneOptions,
  BenchmarkOptions,
  BenchmarkResult,
  DetailedStats,
  MemoryUsage,
  ScoreBreakdown,
  SuggestionConfig,
  SystemStats,
} from '../interfaces/suggestion.interface';
import { MinHeap } from '../helpers/min-heap.helper';

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
export class SuggestionService1 implements OnModuleInit {
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
    setInterval(() => this.updatePopularQueries(), 60_000); // Update popular queries every minute
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
            prefixWeight: 1 - weights.trigram - weights.levenshtein,
            earlyExitThreshold: this.config.earlyExitThreshold,
            batchProcessingSize: this.config.batchProcessingSize,
            warmupEnabled: this.config.warmupEnabled,
            maxWordsPerNode: this.config.maxWordsPerNode,
            cacheSize: this.config.cacheSize,
            enableBenchmarking: this.config.enableBenchmarking,
            lengthPenaltyWeight: this.config.lengthPenaltyWeight, // 0.05
            popularQueryTTLMs: this.config.popularQueryTTLMs, // 2 hour
            frequentQueryTTLMs: this.config.frequentQueryTTLMs, // 30 minutes
            defaultQueryTTLMs: this.config.defaultQueryTTLMs, // 5 minutes
            minQueryLength: this.config.minQueryLength, // 3 chars
            maxLocalCacheSize: this.config.maxLocalCacheSize, // 500
            wampUpSize: this.config.wampUpSize,
            coldStartBenchmark: this.config.coldStartBenchmark, // false
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

// =================== ENHANCED SUGGESTION SERVICE ===================
@Injectable()
export class SuggestionService implements OnModuleInit {
  private readonly logger = new Logger(SuggestionService.name);
  private queryStats = new Map<
    string,
    { count: number; timestamp: number; avgResponseTime: number }
  >();
  private popularQueries: string[] = [];
  private isWarmedUp = false;

  constructor(
    @Inject(suggestionConfig.KEY)
    private readonly config: ConfigType<typeof suggestionConfig>,
    private readonly bkTreeService: BKTreeService,
    private readonly trigramIndexService: TrigramIndexService,
    private readonly trieService: TrieService,
    private readonly levenshteinService: LevenshteinService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Lifecycle hook that is called when the module is initialized.
   * Logs the initialization and sets up periodic tasks:
   * - Updates popular queries every 5 minutes.
   * - Cleans up old query statistics every hour.
   */
  onModuleInit() {
    this.logger.log('SuggestionService initialized');

    // Update popular queries every 5 minutes
    setInterval(() => this.updatePopularQueries(), 5 * 60_000);
    // Cleanup old query stats every hour
    setInterval(() => this.cleanupQueryStats(), 60 * 60_000);
  }

  async initialize(words: string[]): Promise<void> {
    const uniqueWords = [...new Set(words.filter((w) => w && w.trim()))];
    this.logger.log(`Initializing with ${uniqueWords.length} unique words`);

    // const start = performance.now();
    const start = process.hrtime.bigint();

    // Parallel initialization
    await Promise.all([
      Promise.resolve(this.bkTreeService.buildTree(uniqueWords)),
      Promise.resolve(this.trigramIndexService.buildIndex(uniqueWords)),
      Promise.resolve(this.trieService.buildTrie(uniqueWords)),
    ]);

    // const duration = performance.now() - start;
    const duration = Number(process.hrtime.bigint() - start);
    this.logger.log(`Indices built in ${duration.toFixed(2)}ns`);

    // Conditional warmup
    if (this.config.warmupEnabled && uniqueWords.length <= 10000) {
      await this.warmupCache(this.generateWarmupQueries(uniqueWords));
      this.isWarmedUp = true;
    }
  }

  private generateWarmupQueries(words: string[]): string[] {
    const queries = new Set<string>();
    const sampleSize = Math.min(this.config.wampUpSize, words.length);

    // Random sampling
    for (let i = 0; i < sampleSize; i++) {
      const word = words[Math.floor(Math.random() * words.length)];

      // Generate variations
      queries.add(word.slice(0, Math.floor(word.length * 0.7))); // Prefix
      queries.add(word.slice(0, -1)); // Missing last char
      queries.add('x' + word.slice(1)); // Wrong first char
      if (word.length > 3) {
        queries.add(word.slice(0, 2) + word.slice(3)); // Missing middle char
      }
    }

    return Array.from(queries).slice(0, 1000);
  }

  private async warmupCache(queries: string[]): Promise<void> {
    this.logger.log(`Warming up cache with ${queries.length} queries...`);
    const start = performance.now();
    const batchSize = this.config.batchProcessingSize;

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      await Promise.all(batch.map((query) => this.getSuggestions(query)));

      // Yield control periodically
      if (i % (batchSize * 5) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    const duration = performance.now() - start;
    this.logger.log(
      `Cache warmed up with ${queries.length} queries in ${duration.toFixed(2)}ms`,
    );
  }

  getSuggestions(
    query: string,
    configOverride?: Partial<SuggestionConfig>,
  ): string[] {
    const startTime = performance.now();
    const config = { ...this.config, ...configOverride };
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery || normalizedQuery.length > config.maxWordsPerNode)
      return [];

    // Update query statistics
    this.updateQueryStats(normalizedQuery, startTime);

    // Generate a robust cache key. For production.
    const cacheKey = `${normalizedQuery}_${this.hashConfig(config)}`;

    // Fast path for very short queries
    if (normalizedQuery.length < config.minQueryLength) {
      const result = this.trieService.getWordsWithPrefix(
        normalizedQuery,
        config.maxSuggestions,
      );
      this.cacheSuggestions(cacheKey, result, config);
      return result;
    }

    // Check cache
    if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
      return this.cache.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
    }

    const suggestions = this.computeSuggestions(normalizedQuery, config);

    // Cache suggestions
    this.cacheSuggestions(cacheKey, suggestions, config);

    return suggestions;
  }

  private computeSuggestions(
    query: string,
    config: SuggestionConfig,
  ): string[] {
    const adaptiveThreshold = this.getAdaptiveThreshold(query);

    // Strategy 1: Exact prefix matching (highest precision)
    const prefixMatches = this.trieService.getWordsWithPrefix(
      query,
      config.maxSuggestions * 3,
    );

    if (prefixMatches.length >= config.maxSuggestions) {
      return this.rankCandidates(query, prefixMatches, config).slice(
        0,
        config.maxSuggestions,
      );
    }

    // Strategy 2: BK-Tree search for small edit distances (fast, good recall)
    const candidates = new Set(prefixMatches);
    const bkResults = this.bkTreeService.search(
      query,
      adaptiveThreshold,
      config.maxTrigramCandidates,
    );
    bkResults.forEach((word) => candidates.add(word));

    // Early exit if we have enough high-quality candidates
    if (candidates.size >= config.maxSuggestions * 2) {
      const ranked = this.rankCandidates(query, Array.from(candidates), config);
      if (
        ranked.length > 0 &&
        this.calculateCompositeScore(query, ranked[0], config) >=
          config.earlyExitThreshold
      ) {
        return ranked.slice(0, config.maxSuggestions);
      }
    }

    // Strategy 3: Trigram fallback (broader coverage)
    if (candidates.size < config.maxTrigramCandidates) {
      const trigramCandidates = this.trigramIndexService.getTopCandidates(
        query,
        config.maxTrigramCandidates - candidates.size,
        config.minTrigramSimilarity,
      );
      trigramCandidates.forEach((word) => candidates.add(word));
    }

    // Score and rank all collected candidates
    return this.rankCandidates(query, Array.from(candidates), config);
  }

  private rankCandidates(
    query: string,
    candidates: string[],
    config: SuggestionConfig,
  ): string[] {
    if (candidates.length === 0) return [];

    // Use heap for efficient top-k selection
    const heap = new MinHeap<{ candidate: string; score: number }>(
      (a, b) => a.score - b.score,
    );

    for (const candidate of candidates) {
      const score = this.calculateCompositeScore(query, candidate, config);

      if (heap.size() < config.maxSuggestions) {
        heap.push({ candidate, score });
      } else if (score > heap.peek()!.score) {
        heap.pop();
        heap.push({ candidate, score });
      }
    }

    return heap
      .toSortedArray()
      .sort((a, b) => b.score - a.score)
      .map((item) => item.candidate);
  }

  private calculateCompositeScore(
    query: string,
    candidate: string,
    config: SuggestionConfig,
  ): number {
    // Prefix bonus
    const prefixBonus = candidate.toLowerCase().startsWith(query.toLowerCase())
      ? 1
      : 0;

    // Trigram similarity
    const trigramSim = this.trigramIndexService.calculateSimilarity(
      query,
      candidate,
    );

    // Levenshtein similarity (normalized to 0-1, higher is better)
    const maxLen = Math.max(query.length, candidate.length);
    const levDistance = this.levenshteinService.calculateDistance(
      query,
      candidate,
      config.maxLevenshteinDistance,
    );
    const levSim = maxLen === 0 ? 1 : Math.max(0, 1 - levDistance / maxLen);

    // Length penalty (prefer similar lengths)
    const lengthDiff = Math.abs(query.length - candidate.length);
    const lengthPenalty =
      1 - lengthDiff / Math.max(query.length, candidate.length);

    // Composite score with configurable weights
    return (
      config.trigramWeight * trigramSim +
      config.levenshteinWeight * levSim +
      config.prefixWeight * prefixBonus +
      0.05 * lengthPenalty // Small bonus for similar length
    );
  }

  private getAdaptiveThreshold(query: string): number {
    // Shorter queries need stricter thresholds
    if (query.length <= 3) return 1; // Allow 1 typo for very short words
    if (query.length <= 5) return 2; // Allow 2 typos for medium words

    // Dynamic threshold based on query characteristics
    const uniqueChars = new Set(query).size;
    const complexity = uniqueChars / query.length;

    const threshold = Math.min(
      this.config.maxLevenshteinDistance,
      Math.floor(query.length * 0.3),
    );

    // Reduce threshold for repetitive patterns
    return complexity < 0.5 ? Math.max(1, threshold - 1) : threshold;
  }

  private updateQueryStats(query: string, startTime: number): void {
    const responseTime = performance.now() - startTime;
    const existing = this.queryStats.get(query);

    if (existing) {
      existing.count++;
      existing.avgResponseTime = (existing.avgResponseTime + responseTime) / 2;
      existing.timestamp = Date.now();
    } else {
      this.queryStats.set(query, {
        count: 1,
        timestamp: Date.now(),
        avgResponseTime: responseTime,
      });
    }
  }

  private updatePopularQueries(): void {
    const now = Date.now();
    const oneHour = 3600_000;

    // Weight by recency and frequency
    this.popularQueries = Array.from(this.queryStats.entries())
      .filter(([, stats]) => now - stats.timestamp < oneHour)
      .map(([query, stats]) => ({
        query,
        score: stats.count * Math.exp(-(now - stats.timestamp) / oneHour),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 250)
      .map((item) => item.query);

    this.logger.debug(`Updated ${this.popularQueries.length} popular queries`);
  }

  private cleanupQueryStats(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [query, stats] of this.queryStats.entries()) {
      if (now - stats.timestamp > maxAge) {
        this.queryStats.delete(query);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old query stats`);
    }
  }

  private cacheSuggestions(
    cacheKey: string,
    suggestions: string[],
    config: SuggestionConfig,
  ): void {
    // Adaptive caching calculate TTL based on query popularity
    const ttl = this.calculateCacheTTL(cacheKey.split('_')[0]);
    this.cache.set(SUGGESTION_CACHE, cacheKey, suggestions, {
      config: {
        maxSize: config.cacheSize,
        defaultTTL: ttl,
        sizeCalculation: (items: string[]) =>
          items.reduce((sum, item) => sum + item.length * 2 + 16, 64), // Overhead estimation
      },
    });
  }

  private calculateCacheTTL(query: string): number {
    // Popular queries stay longer in cache
    const isPopular = this.popularQueries.includes(query);
    const baseStats = this.queryStats.get(query);

    return isPopular || (baseStats && baseStats.count > 5)
      ? this.config.popularQueryTTLMs // 2 hours for popular queries
      : baseStats && baseStats.count > 2
        ? this.config.frequentQueryTTLMs // 30 minutes for moderately used
        : this.config.defaultQueryTTLMs; // 5 minutes for new queries
  }

  private hashConfig(config: SuggestionConfig): string {
    // Create a compact hash of relevant config values
    const key = `${config.maxSuggestions}_${config.minTrigramSimilarity}_${config.maxTrigramCandidates}_${config.maxLevenshteinDistance}_${config.trigramWeight}_${config.levenshteinWeight}_${config.lengthPenaltyWeight}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  // =================== BENCHMARKING ===================

  benchmark(testQueries: string[]): BenchmarkResult {
    if (!this.config.enableBenchmarking) {
      this.logger.warn('Benchmarking is disabled');
      return {
        avgResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        throughput: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    if (this.config.coldStartBenchmark) {
      // Optionally, clear caches to ensure fresh runs between benchmarks
      this.cache.clear(SUGGESTION_CACHE);
      this.cache.clear(LEVENSHTEIN_CACHE);
      this.queryStats.clear(); // Clear query stats for consistent runs
    }

    this.logger.log(`Starting benchmark with ${testQueries.length} queries`);

    const results: bigint[] = [];
    const errors: string[] = [];
    let cacheHits = 0;

    // const startTime = performance.now();
    const startTime = process.hrtime.bigint();

    for (const query of testQueries) {
      // const queryStart = performance.now();
      const queryStart = process.hrtime.bigint();

      try {
        const beforeCacheSize = this.getCacheStats().stat.size;
        this.getSuggestions(query);
        const afterCacheSize = this.getCacheStats().stat.size;

        // If cache size didn't change, it was a cache hit
        if (afterCacheSize === beforeCacheSize) {
          cacheHits++;
        }

        // results.push(performance.now() - queryStart);
        results.push(process.hrtime.bigint() - queryStart);
      } catch (error) {
        errors.push(
          `${query}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // results.push(performance.now() - queryStart);
        results.push(process.hrtime.bigint() - queryStart);
      }
    }

    // const totalTime = performance.now() - startTime;
    const totalTime = Number(process.hrtime.bigint() - startTime);

    // Calculate statistics
    results.sort((a, b) => Number(a - b));
    const avgResponseTime =
      results.reduce((sum, time) => sum + Number(time), 0) / results.length;
    const medianResponseTime = Number(results[Math.floor(results.length / 2)]);
    const p95ResponseTime = Number(results[Math.floor(results.length * 0.95)]);
    const throughput = testQueries.length / (totalTime / 1000); // queries per second
    const cacheHitRate = cacheHits / testQueries.length;
    const errorRate = errors.length / testQueries.length;

    const result: BenchmarkResult = {
      avgResponseTime,
      medianResponseTime,
      p95ResponseTime,
      throughput,
      cacheHitRate,
      errorRate,
    };

    this.logger.log('Benchmark Results:', result);

    if (errors.length > 0) {
      this.logger.warn(
        `Benchmark errors (${errors.length}):`,
        errors.slice(0, 10),
      );
    }

    return result;
  }

  /**
   * Advanced benchmark with cache warming and detailed metrics
   */
  async benchmarkAdvanced(
    testQueries: string[],
    options: BenchmarkOptions = {},
  ): Promise<AdvancedBenchmarkResult> {
    const {
      warmCache = false,
      clearCacheFirst = false,
      iterations = 1,
      measureMemory = false,
    } = options;

    if (!this.config.enableBenchmarking) {
      this.logger.warn('Benchmarking is disabled');
      throw new Error('Benchmarking is disabled in configuration');
    }

    this.logger.log(
      `Starting advanced benchmark with ${testQueries.length} queries, ${iterations} iterations`,
    );

    // Optional cache clearing
    if (clearCacheFirst) {
      this.clearCaches();
      this.logger.log('Caches cleared for cold start benchmark');
    }

    // Optional cache warming
    if (warmCache && !clearCacheFirst) {
      await this.warmupCache(
        testQueries.slice(0, Math.min(100, testQueries.length)),
      );
      this.logger.log('Cache warmed up');
    }

    const allResults: number[] = [];
    const iterationResults: number[][] = [];
    const errors: string[] = [];
    let totalCacheHits = 0;

    // Memory measurement setup
    const memoryBefore = measureMemory ? this.getMemoryUsage() : null;

    // const totalStartTime = performance.now();
    const totalStartTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const iterationTimes: number[] = [];
      // const iterationStartTime = performance.now();
      const iterationStartTime = process.hrtime.bigint();

      for (const query of testQueries) {
        // const queryStart = performance.now();
        const queryStart = process.hrtime.bigint();

        try {
          const beforeCacheSize = this.getCacheStats().stat.size;
          this.getSuggestions(query);
          const afterCacheSize = this.getCacheStats().stat.size;

          // If cache size didn't change, it was a cache hit
          if (afterCacheSize === beforeCacheSize) {
            totalCacheHits++;
          }

          // const queryTime = performance.now() - queryStart;
          const queryTime = Number(process.hrtime.bigint() - queryStart);
          iterationTimes.push(queryTime);
          allResults.push(queryTime);
        } catch (error) {
          errors.push(
            `Iteration ${i}, Query "${query}": ${error instanceof Error ? error.message : String(error)}`,
          );
          // const queryTime = performance.now() - queryStart;
          const queryTime = Number(process.hrtime.bigint() - queryStart);
          iterationTimes.push(queryTime);
          allResults.push(queryTime);
        }
      }

      iterationResults.push(iterationTimes);

      // const iterationTime = performance.now() - iterationStartTime;
      const iterationTime = Number(
        process.hrtime.bigint() - iterationStartTime,
      );
      this.logger.log(
        `Iteration ${i + 1}/${iterations} completed in ${iterationTime.toFixed(2)}ms`,
      );
    }

    // const totalTime = performance.now() - totalStartTime;
    const totalTime = Number(process.hrtime.bigint() - totalStartTime);
    const memoryAfter = measureMemory ? this.getMemoryUsage() : null;

    // Calculate comprehensive statistics
    allResults.sort((a, b) => a - b);
    const stats = this.calculateDetailedStats(allResults);

    const result: AdvancedBenchmarkResult = {
      ...stats,
      totalQueries: testQueries.length * iterations,
      totalTime,
      throughput: (testQueries.length * iterations) / (totalTime / 1000),
      cacheHitRate: totalCacheHits / (testQueries.length * iterations),
      errorRate: errors.length / (testQueries.length * iterations),
      iterationStats: iterationResults.map((times) =>
        this.calculateDetailedStats(times),
      ),
      memoryUsage:
        memoryBefore && memoryAfter
          ? {
              before: memoryBefore,
              after: memoryAfter,
              delta: memoryAfter.used - memoryBefore.used,
            }
          : undefined,
      errors: errors.slice(0, 20), // Keep only first 20 errors
    };

    this.logger.log('Advanced Benchmark Results:', {
      avgResponseTime: result.avgResponseTime.toFixed(3),
      throughput: result.throughput.toFixed(1),
      cacheHitRate: (result.cacheHitRate * 100).toFixed(1) + '%',
      errorRate: (result.errorRate * 100).toFixed(2) + '%',
    });

    if (errors.length > 0) {
      this.logger.warn(`Benchmark completed with ${errors.length} errors`);
    }

    return result;
  }

  private calculateDetailedStats(times: number[]): DetailedStats {
    const sorted = [...times].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      avgResponseTime: times.reduce((sum, time) => sum + time, 0) / len,
      medianResponseTime:
        len % 2 === 0
          ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
          : sorted[Math.floor(len / 2)],
      p95ResponseTime: sorted[Math.floor(len * 0.95)],
      p99ResponseTime: sorted[Math.floor(len * 0.99)],
      minResponseTime: sorted[0],
      maxResponseTime: sorted[len - 1],
      stdDeviation: this.calculateStandardDeviation(times),
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private getMemoryUsage(): MemoryUsage | null {
    // Node.js specific - replace with appropriate implementation for your environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        external: usage.external,
      };
    }
    return null;
  }

  // =================== AUTO-TUNING ===================

  async autoTune(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    options: AutoTuneOptions = {},
  ): Promise<SuggestionConfig> {
    const {
      maxIterations = 100,
      initialTemp = 15.0,
      coolingRate = 0.95,
      convergenceThreshold = 0.001,
      validationSplit = 0.2,
    } = options;

    // Split test cases into training and validation
    const shuffled = [...testCases].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(testCases.length * (1 - validationSplit));
    const trainingCases = shuffled.slice(0, splitIndex);
    const validationCases = shuffled.slice(splitIndex);

    let currentConfig = { ...this.config };
    let currentScore = await this.evaluateConfig(trainingCases);
    let bestConfig = { ...currentConfig };
    let bestScore = currentScore;
    let bestValidationScore = await this.evaluateConfig(validationCases);

    let temperature = initialTemp;
    let noImprovementCount = 0;
    const maxNoImprovement = 20;

    this.logger.log(
      `Starting auto-tune with ${trainingCases.length} training cases, ${validationCases.length} validation cases`,
    );
    this.logger.log(
      `Initial training score: ${currentScore.toFixed(4)}, validation score: ${bestValidationScore.toFixed(4)}`,
    );

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const candidateConfig = this.perturbConfig(currentConfig, temperature);
      const candidateScore = await this.evaluateConfig(trainingCases);

      // Simulated annealing acceptance criterion
      const accept =
        candidateScore > currentScore ||
        Math.random() < Math.exp((candidateScore - currentScore) / temperature);

      if (accept) {
        currentConfig = candidateConfig;
        currentScore = candidateScore;

        // Check validation score for best config
        const validationScore = await this.evaluateConfig(validationCases);

        if (validationScore > bestValidationScore) {
          bestConfig = { ...candidateConfig };
          bestScore = candidateScore;
          bestValidationScore = validationScore;
          noImprovementCount = 0;

          this.logger.log(
            `New best config at iteration ${iteration}: ` +
              `training=${bestScore.toFixed(4)}, validation=${bestValidationScore.toFixed(4)}`,
          );
        } else {
          noImprovementCount++;
        }
      } else {
        noImprovementCount++;
      }

      // Early stopping
      if (noImprovementCount >= maxNoImprovement) {
        this.logger.log(
          `Early stopping at iteration ${iteration} (no improvement for ${maxNoImprovement} iterations)`,
        );
        break;
      }

      // Convergence check
      if (Math.abs(candidateScore - currentScore) < convergenceThreshold) {
        this.logger.log(`Converged at iteration ${iteration}`);
        break;
      }

      temperature *= coolingRate;

      // Progress logging
      if (iteration % 10 === 0) {
        this.logger.log(
          `Iteration ${iteration}: current=${currentScore.toFixed(4)}, best=${bestScore.toFixed(4)}, temp=${temperature.toFixed(3)}`,
        );
      }
    }

    this.clearCaches();
    this.logger.log(
      `Auto-tune complete. Best validation score: ${bestValidationScore.toFixed(4)}`,
    );

    return bestConfig;
  }

  private perturbConfig(
    config: SuggestionConfig,
    temperature: number,
  ): SuggestionConfig {
    const newConfig = { ...config };

    // Adaptive perturbation based on temperature
    const perturbationStrength = Math.max(0.1, temperature / 15.0);

    const perturbations = [
      // Trigram similarity threshold
      () => {
        newConfig.minTrigramSimilarity = this.clamp(
          config.minTrigramSimilarity +
            (Math.random() - 0.5) * 0.2 * perturbationStrength,
          0.1,
          0.8,
        );
      },

      // Levenshtein distance
      () => {
        newConfig.maxLevenshteinDistance = Math.round(
          this.clamp(
            config.maxLevenshteinDistance +
              (Math.random() - 0.5) * 2 * perturbationStrength,
            1,
            6,
          ),
        );
      },

      // Weight adjustments (maintaining sum ≈ 1)
      () => {
        const totalWeight =
          config.trigramWeight + config.levenshteinWeight + config.prefixWeight;
        const delta = (Math.random() - 0.5) * 0.3 * perturbationStrength;

        newConfig.trigramWeight = this.clamp(
          config.trigramWeight + delta,
          0.1,
          0.7,
        );
        const remaining = totalWeight - newConfig.trigramWeight;

        const levRatio =
          config.levenshteinWeight /
          (config.levenshteinWeight + config.prefixWeight);
        newConfig.levenshteinWeight = remaining * levRatio;
        newConfig.prefixWeight = remaining * (1 - levRatio);
      },

      // Candidate limits
      () => {
        newConfig.maxTrigramCandidates = Math.round(
          this.clamp(
            config.maxTrigramCandidates +
              (Math.random() - 0.5) * 50 * perturbationStrength,
            20,
            200,
          ),
        );
      },

      // Early exit threshold (temperature-dependent adjustment)
      () => {
        newConfig.earlyExitThreshold = this.clamp(
          config.earlyExitThreshold +
            (Math.random() - 0.5) * 0.1 * perturbationStrength,
          0.7,
          0.99,
        );
      },
    ];

    // Apply 1-3 random perturbations
    const numPerturbations = Math.min(3, Math.floor(Math.random() * 3) + 1);
    const selectedPerturbations = this.shuffleArray([...perturbations]).slice(
      0,
      numPerturbations,
    );

    selectedPerturbations.forEach((perturbation) => perturbation());

    return newConfig;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private async evaluateConfig(
    testCases: Array<{ query: string; expectedResults: string[] }>,
  ): Promise<number> {
    this.clearCaches();

    let totalScore = 0;
    const batchSize = 10;

    for (let i = 0; i < testCases.length; i += batchSize) {
      const batch = testCases.slice(i, i + batchSize);

      const batchPromises = batch.map(({ query, expectedResults }) => {
        const suggestions = this.getSuggestions(query);
        return this.calculateMetrics(suggestions, expectedResults);
      });

      const batchScores = await Promise.all(batchPromises);
      totalScore += batchScores.reduce((sum, score) => sum + score, 0);

      // Yield control periodically
      if (i % (batchSize * 5) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    return totalScore / testCases.length;
  }

  private calculateMetrics(
    suggestions: string[],
    expectedResults: string[],
  ): number {
    const expectedSet = new Set(expectedResults.map((r) => r.toLowerCase()));
    const suggestionSet = new Set(suggestions.map((s) => s.toLowerCase()));

    const intersection = new Set(
      [...suggestionSet].filter((s) => expectedSet.has(s)),
    );

    // Precision: relevant suggestions / total suggestions
    const precision =
      suggestionSet.size > 0 ? intersection.size / suggestionSet.size : 0;

    // Recall: relevant suggestions / total relevant
    const recall =
      expectedSet.size > 0 ? intersection.size / expectedSet.size : 1;

    // F1 Score
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    // NDCG for ranking quality
    const ndcg = this.calculateNDCG(suggestions, expectedResults);

    // Composite score
    return 0.6 * f1 + 0.4 * ndcg;
  }

  private calculateNDCG(
    suggestions: string[],
    expectedResults: string[],
    k: number = 5,
  ): number {
    const expectedSet = new Set(expectedResults.map((r) => r.toLowerCase()));

    // DCG calculation
    let dcg = 0;
    for (let i = 0; i < Math.min(k, suggestions.length); i++) {
      const relevance = expectedSet.has(suggestions[i].toLowerCase()) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2);
    }

    // IDCG calculation (perfect ranking)
    let idcg = 0;
    const maxRelevant = Math.min(k, expectedResults.length);
    for (let i = 0; i < maxRelevant; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }

  // =================== UTILITIES ===================
  clearCaches(): void {
    this.cache.clear(SUGGESTION_CACHE);
    this.cache.clear(LEVENSHTEIN_CACHE);
    this.logger.debug('All caches cleared');
  }

  getCacheStats(): { stat: CacheStats<unknown>; maxSize: number } {
    return {
      stat: this.cache.stats(SUGGESTION_CACHE),
      maxSize: this.config.cacheSize,
    };
  }

  getSystemStats(): SystemStats {
    const queryStatsSize = this.queryStats.size;
    const popularQueriesCount = this.popularQueries.length;
    const bkTreeStats = this.bkTreeService.getStats();

    return {
      isWarmedUp: this.isWarmedUp,
      queryStatsSize,
      popularQueriesCount,
      bkTreeNodeCount: bkTreeStats.nodeCount,
      cacheStats: this.getCacheStats(),
    };
  }

  // =================== ADVANCED FEATURES ===================

  /**
   * Get suggestions with detailed scoring breakdown
   */
  getSuggestionsWithScores(
    query: string,
  ): Array<{ word: string; score: number; breakdown: ScoreBreakdown }> {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const candidates = this.getAllCandidates(normalizedQuery);

    return candidates
      .map((candidate) => {
        const breakdown = this.getScoreBreakdown(normalizedQuery, candidate);
        const totalScore = this.calculateCompositeScore(
          normalizedQuery,
          candidate,
          this.config,
        );

        return {
          word: candidate,
          score: totalScore,
          breakdown,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxSuggestions);
  }

  private getAllCandidates(query: string): string[] {
    const candidates = new Set<string>();

    // Get candidates from all strategies
    const prefixMatches = this.trieService.getWordsWithPrefix(query, 50);
    const bkResults = this.bkTreeService.search(
      query,
      this.getAdaptiveThreshold(query),
      50,
    );
    const trigramResults = this.trigramIndexService.getTopCandidates(
      query,
      50,
      this.config.minTrigramSimilarity,
    );

    prefixMatches.forEach((word) => candidates.add(word));
    bkResults.forEach((word) => candidates.add(word));
    trigramResults.forEach((word) => candidates.add(word));

    return Array.from(candidates);
  }

  private getScoreBreakdown(query: string, candidate: string): ScoreBreakdown {
    const prefixMatch = candidate.toLowerCase().startsWith(query.toLowerCase());
    const trigramSim = this.trigramIndexService.calculateSimilarity(
      query,
      candidate,
    );

    const maxLen = Math.max(query.length, candidate.length);
    const levDistance = this.levenshteinService.calculateDistance(
      query,
      candidate,
    );
    const levSim = maxLen === 0 ? 1 : Math.max(0, 1 - levDistance / maxLen);

    const lengthDiff = Math.abs(query.length - candidate.length);
    const lengthSim = 1 - lengthDiff / Math.max(query.length, candidate.length);

    return {
      prefixMatch,
      trigramSimilarity: trigramSim,
      levenshteinSimilarity: levSim,
      lengthSimilarity: lengthSim,
      editDistance: levDistance,
    };
  }

  /**
   * Batch processing for multiple queries
   */
  async batchGetSuggestions(
    queries: string[],
    batchSize: number = 50,
  ): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      const batchPromises = batch.map((query) => {
        const suggestions = this.getSuggestions(query);
        return [query, suggestions] as [string, string[]];
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(([query, suggestions]) => {
        results.set(query, suggestions);
      });

      // Yield control between batches
      await new Promise((resolve) => setImmediate(resolve));
    }

    return results;
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
