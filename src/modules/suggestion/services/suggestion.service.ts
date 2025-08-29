// src/utils/levenshtein/suggestion.engine.ts
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import {
  LEVENSHTEIN_CACHE,
  SUGGESTION_CACHE,
} from 'src/modules/cache/tokens/cache.tokens';
import suggestionConfig from '../configs/suggestion.config';
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
  Candidate,
  DetailedStats,
  MemoryUsage,
  PerformanceMetrics,
  ScoreBreakdown,
  SuggestionConfig,
  SystemStats,
} from '../interfaces/suggestion.interface';
import { MinHeap } from '../helpers/min-heap.helper';
import farmhash from 'farmhash';
import * as CBOR from 'cbor';

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
    bkResults.forEach((word) => candidates.add(word.word));

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
            warmUpSize: this.config.warmUpSize,
            coldStartBenchmark: this.config.coldStartBenchmark,
            highDiversityThreshold: this.config.highDiversityThreshold,
            lowDiversityThreshold: this.config.lowDiversityThreshold,
            diversityAdjustmentStrength:
              this.config.diversityAdjustmentStrength,
            lengthThresholdRatio: this.config.lengthThresholdRatio,
            initTimeboxMs: this.config.initTimeboxMs,
            warmupTimeboxMs: this.config.warmupTimeboxMs,
            maxWarmupWords: this.config.maxWarmupWords,
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

console.log('[DEBUG] Loaded SuggestionService file');
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
  private queryLimiter = new Map<string, bigint>();
  private errorCount = 0;
  private lastErrorTime = BigInt(0);

  // Performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    totalQueries: 0,
    totalTime: BigInt(0),
    cacheHits: 0,
    errors: 0,
  };

  private queryLengthStats = {
    sum: 0,
    count: 0,
    squares: 0,
    lengths: new Map<number, number>(),
  };

  constructor(
    @Inject(suggestionConfig.KEY)
    private readonly config: ConfigType<typeof suggestionConfig>,
    private readonly bkTreeService: BKTreeService,
    private readonly trigramIndexService: TrigramIndexService,
    private readonly trieService: TrieService,
    private readonly levenshteinService: LevenshteinService,
    private readonly cache: CacheService,
  ) {
    console.log('[DEBUG] SuggestionService.constructor');
    this.logger.log('SuggestionService constructed');
  }

  /**
   * Lifecycle hook that is called when the module is initialized.
   * Logs the initialization and sets up periodic tasks:
   * - Updates popular queries every 5 minutes.
   * - Cleans up old query statistics every hour.
   */
  onModuleInit() {
    console.log('[DEBUG] SuggestionService.onModuleInit');
    this.logger.log('SuggestionService initialized');

    // Update popular queries every 3 minutes
    setInterval(() => this.updatePopularQueries(), 3 * 60_000);
    // Cleanup old query stats every 30 minutes
    setInterval(() => this.cleanupQueryStats(), 30 * 60_000);
    // Log performance metrics every 10 minutes
    setInterval(() => this.logPerformanceMetrics(), 10 * 60_000);
  }

  // helper: run a promise but only wait 'ms' milliseconds for it to finish
  private async withTimeout<T>(p: Promise<T>, ms: number) {
    let timer: NodeJS.Timeout | null = null;
    let timedOut = false;

    const timeoutPromise = new Promise<never>((_res, rej) => {
      timer = setTimeout(() => {
        timedOut = true;
        rej(new Error('timeout'));
      }, ms);
    });

    try {
      const result = await Promise.race([p, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return { finished: true, timedOut: false, result: result as T };
    } catch (err) {
      if (timer) clearTimeout(timer);
      return {
        finished: !timedOut ? false : false,
        timedOut: true,
        error: err,
      };
    }
  }

  /**
   * Initialize the suggestion indices and optionally warm up cache.
   *
   * - Timeboxed: will wait up to config.initTimeboxMs for index builds and
   *   config.warmupTimeboxMs for warmup. If timeboxes are exceeded, the
   *   remaining work continues in background and bootstrap is not blocked.
   *
   * - This is defensive: quick runs will still fully complete synchronously.
   */
  async initialize2(
    words: string[],
    options?: { blockingMs: number },
  ): Promise<void> {
    const uniqueWords = [...new Set(words.filter((w) => w && w.trim()))];
    this.logger.log(`Initializing with ${uniqueWords.length} unique words`);

    const start = process.hrtime.bigint();

    // Kick off the builds but don't necessarily wait forever.
    const compPromises = {
      bk: this.safeInitialize(
        () => this.bkTreeService.buildTree(uniqueWords),
        'BK-Tree',
      ),
      trigram: this.safeInitialize(
        () => this.trigramIndexService.buildIndex(uniqueWords),
        'Trigram Index',
      ),
      trie: this.safeInitialize(
        () => this.trieService.buildTrie(uniqueWords),
        'Trie',
      ),
    };

    // Determine timebox values (ms). Allow caller override via options.
    const initTimeboxMs =
      options?.blockingMs ?? this.config.initTimeboxMs ?? 3000;

    // Wait up to initTimeboxMs for all builds to settle.
    const allSettledPromise = Promise.allSettled([
      compPromises.bk,
      compPromises.trigram,
      compPromises.trie,
    ]);

    const waitResult = await this.withTimeout(allSettledPromise, initTimeboxMs);

    if (waitResult.timedOut) {
      // Timeboxed: don't block further. Let builds continue in background.
      this.logger.warn(
        `Index builds not finished within ${initTimeboxMs}ms — continuing bootstrap and letting initialization finish in background.`,
      );

      // Attach catchers so background failures are logged.
      compPromises.bk.catch((e) =>
        this.logger.error('BK-Tree background init failed', e),
      );
      compPromises.trigram.catch((e) =>
        this.logger.error('Trigram background init failed', e),
      );
      compPromises.trie.catch((e) =>
        this.logger.error('Trie background init failed', e),
      );

      // We won't throw; bootstrap proceeds.
    } else {
      // All finished (either fulfilled or rejected).
      const results = waitResult.result as PromiseSettledResult<void>[];
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        this.logger.error(
          `Failed to initialize ${failures.length} component(s):`,
          failures,
        );
        // Re-throw to preserve original error semantics.
        throw new Error(
          `Initialization failed for ${failures.length} components`,
        );
      }
    }

    const durationNs = process.hrtime.bigint() - start;
    // convert to ms for logging clarity
    const durationMs = Number(durationNs / BigInt(1_000_000));
    this.logger.log(
      `Indices build orchestration completed (observed): ${durationMs}ms`,
    );

    // Conditional warmup (timeboxed similarly)
    try {
      if (
        this.config.warmupEnabled &&
        uniqueWords.length <= (this.config.maxWarmupWords ?? 10000)
      ) {
        const warmupTimeboxMs = this.config.warmupTimeboxMs ?? 3000;

        const warmupPromise = this.warmupCache(
          this.generateWarmupQueries(uniqueWords),
        );

        const warmupWait = await this.withTimeout(
          warmupPromise,
          warmupTimeboxMs,
        );

        if (warmupWait.timedOut) {
          this.logger.warn(
            `Warmup didn't finish within ${warmupTimeboxMs}ms — continuing bootstrap while warmup completes in background.`,
          );
          // Ensure background errors are logged.
          warmupPromise.catch((e) =>
            this.logger.error('Background warmup failed', e),
          );
        } else {
          this.isWarmedUp = true;
        }
      } else if (uniqueWords.length > (this.config.maxWarmupWords ?? 50_000)) {
        this.logger.log('Skipping warmup for large dataset (> maxWarmupWords)');
      }
    } catch (err) {
      this.logger.error('Error during conditional warmup:', err);
      // do not rethrow so that initialization doesn't block forever
    }
  }

  async initialize(words: string[]): Promise<void> {
    const uniqueWords = [...new Set(words.filter((w) => w && w.trim()))];
    this.logger.log(`Initializing with ${uniqueWords.length} unique words`);

    const start = process.hrtime.bigint();

    // Build promise that runs the three index builds sequentially with safeInitialize
    const buildPromise = (async () => {
      await this.safeInitialize(
        () => this.bkTreeService.buildTree(uniqueWords),
        'BK-Tree',
      );
      await this.safeInitialize(
        () => this.trigramIndexService.buildIndex(uniqueWords),
        'Trigram Index',
      );
      await this.safeInitialize(
        () => this.trieService.buildTrie(uniqueWords),
        'Trie',
      );
    })();

    // Timebox for the initial bootstrap phase (configurable)
    const initTimeboxMs = this.config.initTimeboxMs ?? 3000;

    // If the build finishes within timebox, await it and continue normally.
    // Otherwise return early (so bootstrap completes) and let the build continue in background.
    const finishedInTime = await Promise.race([
      buildPromise
        .then(() => true)
        .catch((err) => {
          // ensure any synchronous thrown errors bubble up and are logged
          this.logger.error('Index build failed during init:', err);
          return true;
        }),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), initTimeboxMs),
      ),
    ]);

    if (!finishedInTime) {
      const elapsed = Number(process.hrtime.bigint() - start);
      this.logger.warn(
        `Index build did not finish within ${initTimeboxMs}ms (elapsed ${elapsed}ns). Continuing bootstrap; index build continues in background.`,
      );

      // attach a handler so any background errors are logged
      buildPromise
        .then(() => {
          const elapsedNs = Number(process.hrtime.bigint() - start);
          this.logger.log(
            `Background index build completed in ${elapsedNs}ns (total words ${uniqueWords.length}).`,
          );
        })
        .catch((err) => {
          this.logger.error('Background index build failed:', err);
        });

      // optionally kick off background warmup later (see warmupTimebox handling)
    } else {
      const durationNs = Number(process.hrtime.bigint() - start);
      this.logger.log(`Indices built in ${durationNs.toFixed(2)}ns`);
    }

    // Warmup only if enabled — run with its own timebox and detach if it overruns
    if (
      this.config.warmupEnabled &&
      uniqueWords.length <= (this.config.maxWarmupWords ?? 10000)
    ) {
      try {
        const warmupQueries = this.generateWarmupQueries(uniqueWords);
        const warmupPromise = this.warmupCache(warmupQueries);

        const warmupTimeboxMs = this.config.warmupTimeboxMs ?? 3000;

        const warmupFinished = await Promise.race([
          warmupPromise
            .then(() => true)
            .catch((err) => {
              this.logger.error('Warmup failed:', err);
              return true;
            }),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), warmupTimeboxMs),
          ),
        ]);

        if (!warmupFinished) {
          this.logger.warn(
            `Warmup did not finish within ${warmupTimeboxMs}ms — continuing bootstrap; warmup continues in background.`,
          );
          warmupPromise.catch((err) =>
            this.logger.error('Background warmup failed:', err),
          );
        } else {
          this.isWarmedUp = true;
        }
      } catch (err) {
        this.logger.error('Warmup error (non-fatal):', err);
      }
    } else if (uniqueWords.length > (this.config.maxWarmupWords ?? 10000)) {
      this.logger.log('Skipping warmup for large dataset (>maxWarmupWords)');
    }
  }

  /**
   * safeInitialize now returns a Promise so we can start builds and observe them.
   */
  private async safeInitialize(
    initFn: () => Promise<void> | void,
    componentName: string,
  ): Promise<void> {
    try {
      await Promise.resolve(initFn());
      this.logger.log(`${componentName} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Warmup but yield control frequently and be resilient to long runs.
   */
  private async warmupCache(queries: string[]): Promise<void> {
    this.logger.log(`Warming up cache with ${queries.length} queries...`);
    const startMs = Date.now();
    const batchSize = Math.max(1, this.config.batchProcessingSize || 100);

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      // Promise.all but errors should be logged and not crash warmup
      await Promise.all(
        // batch.map((q) =>
        //   this.getSuggestions(q).catch((err) => {
        //     this.logger.warn(
        //       'Warmup query failed for',
        //       q,
        //       err && err.message ? err.message : err,
        //     );
        //     // swallow error
        //   }),
        // ),
        batch.map((q) => {
          try {
            // getSuggestions is synchronous; call inside try/catch to handle errors
            this.getSuggestions(q);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn('Warmup query failed for', q, msg);
            // swallow error
          }
        }),
      );

      // yield back to event loop to avoid starving bootstrap
      if ((i / batchSize) % 5 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    const duration = Date.now() - startMs;
    this.logger.log(
      `Cache warmed up with ${queries.length} queries in ${duration}ms`,
    );
  }

  // async initializeOld(words: string[]): Promise<void> {
  //   const uniqueWords = [...new Set(words.filter((w) => w && w.trim()))];
  //   this.logger.log(`Initializing with ${uniqueWords.length} unique words`);

  //   // const start = performance.now();
  //   const start = process.hrtime.bigint();

  //   // // Parallel initialization
  //   // await Promise.all([
  //   //   Promise.resolve(this.bkTreeService.buildTree(uniqueWords)),
  //   //   Promise.resolve(this.trigramIndexService.buildIndex(uniqueWords)),
  //   //   Promise.resolve(this.trieService.buildTrie(uniqueWords)),
  //   // ]);

  //   // Parallel initialization with error handling
  //   const initPromises = [
  //     this.safeInitialize(
  //       () => this.bkTreeService.buildTree(uniqueWords),
  //       'BK-Tree',
  //     ),
  //     this.safeInitialize(
  //       () => this.trigramIndexService.buildIndex(uniqueWords),
  //       'Trigram Index',
  //     ),
  //     this.safeInitialize(
  //       () => this.trieService.buildTrie(uniqueWords),
  //       'Trie',
  //     ),
  //   ];

  //   const results = await Promise.allSettled(initPromises);
  //   const failures = results.filter((r) => r.status === 'rejected');

  //   if (failures.length > 0) {
  //     this.logger.error(
  //       `Failed to initialize ${failures.length} components:`,
  //       failures,
  //     );
  //     throw new Error(
  //       `Initialization failed for ${failures.length} components`,
  //     );
  //   }

  //   // const duration = performance.now() - start;
  //   const duration = Number(process.hrtime.bigint() - start);
  //   this.logger.log(`Indices built in ${duration.toFixed(2)}ns`);

  //   // Conditional warmup
  //   if (this.config.warmupEnabled && uniqueWords.length <= 10000) {
  //     await this.warmupCache(this.generateWarmupQueries(uniqueWords));
  //     this.isWarmedUp = true;
  //   } else if (uniqueWords.length > 50_000) {
  //     this.logger.log('Skipping warmup for large dataset (>50k words)');
  //   }
  // }

  // private async safeInitialize(
  //   initFn: () => void,
  //   componentName: string,
  // ): Promise<void> {
  //   try {
  //     await Promise.resolve(initFn());
  //     this.logger.log(`${componentName} initialized successfully`);
  //   } catch (error) {
  //     this.logger.error(`Failed to initialize ${componentName}:`, error);
  //     throw error;
  //   }
  // }

  private generateWarmupQueries(words: string[]): string[] {
    const queries = new Set<string>();
    const sampleSize = Math.min(this.config.warmUpSize, words.length);

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

  // private async warmupCache(queries: string[]): Promise<void> {
  //   this.logger.log(`Warming up cache with ${queries.length} queries...`);
  //   const start = performance.now();
  //   const batchSize = this.config.batchProcessingSize;

  //   for (let i = 0; i < queries.length; i += batchSize) {
  //     const batch = queries.slice(i, i + batchSize);
  //     await Promise.all(batch.map((query) => this.getSuggestions(query)));

  //     // Yield control periodically
  //     if (i % (batchSize * 5) === 0) {
  //       await new Promise((resolve) => setImmediate(resolve));
  //     }
  //   }

  //   const duration = performance.now() - start;
  //   this.logger.log(
  //     `Cache warmed up with ${queries.length} queries in ${duration.toFixed(2)}ms`,
  //   );
  // }

  getSuggestions(
    query: string,
    configOverride?: Partial<SuggestionConfig>,
  ): string[] {
    const startTime = process.hrtime.bigint();
    this.performanceMetrics.totalQueries++;

    try {
      // Circuit breaker pattern
      // if (
      //   this.errorCount > 10 &&
      //   startTime - this.lastErrorTime < 5000_000_000
      // ) {
      //   return []; // Fail-fast during error storms
      // }
      if (this.shouldFailFast(startTime))
        return this.getFallbackSuggestions(query);

      const config = { ...this.config, ...configOverride };
      // const normalizedQuery = query.toLowerCase().trim();
      const normalizedQuery = this.normalizeQuery(query);

      // if (!normalizedQuery || normalizedQuery.length > config.maxWordsPerNode)
      //   return [];
      if (!this.isValidQuery(normalizedQuery, config)) {
        return [];
      }

      const lastCall = this.queryLimiter.get(normalizedQuery) || BigInt(0);

      if (startTime - lastCall < 100000000) {
        // 100ms cooldown
        return this.cache.get(SUGGESTION_CACHE, normalizedQuery) || [];
      }
      // Enhanced rate limiting with burst allowance
      if (!this.checkRateLimit(normalizedQuery, startTime)) {
        return this.cache.get(SUGGESTION_CACHE, normalizedQuery) || [];
      }

      // this.queryLimiter.set(normalizedQuery, startTime);

      // Update query statistics
      this.updateQueryStats(normalizedQuery, startTime);
      // Generate a robust cache key. For production.
      // const cacheKey = `${normalizedQuery}_${this.hashConfig(config)}`;
      const cacheKey = this.generateCacheKey(normalizedQuery, config);

      // Fast path for very short queries
      // if (normalizedQuery.length < config.minQueryLength) {
      //   const result = this.trieService.getWordsWithPrefix(
      //     normalizedQuery,
      //     config.maxSuggestions,
      //   );
      //   this.cacheSuggestions(cacheKey, result, config);
      //   return result;
      // }

      // Check cache
      // if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
      //   return this.cache.get<string[]>(SUGGESTION_CACHE, cacheKey)!;
      // }

      // Cache retrieval with compressed storage
      if (this.cache.has(SUGGESTION_CACHE, cacheKey)) {
        return this.decompressSuggestions(
          this.cache.get<Buffer>(SUGGESTION_CACHE, cacheKey)!,
        );
      }

      // const suggestions = this.computeSuggestions(normalizedQuery, config);
      // Compute suggestions with fallback strategies
      const suggestions = this.computeSuggestionsWithFallback(
        normalizedQuery,
        config,
      );

      // Cache suggestions
      this.cacheSuggestions(cacheKey, suggestions, config);

      // Update performance metrics
      const duration = process.hrtime.bigint() - startTime;
      this.performanceMetrics.totalTime += duration;

      return suggestions;
    } catch (error) {
      // this.errorCount++;
      // this.lastErrorTime = process.hrtime.bigint();
      // throw error;
      this.handleError(error, startTime);
      return this.getFallbackSuggestions(query);
    }
  }

  private computeSuggestionsWithFallback(
    query: string,
    config: SuggestionConfig,
  ): string[] {
    try {
      // Primary strategy: fast path for short queries
      if (query.length < config.minQueryLength) {
        return this.trieService.getWordsWithPrefix(
          query,
          config.maxSuggestions,
        );
      }

      return this.computeSuggestions(query, config);
    } catch (error) {
      this.logger.warn(
        `Primary suggestion strategy failed for "${query}":`,
        error,
      );

      // Fallback: simple trie prefix matching
      try {
        return this.trieService.getWordsWithPrefix(
          query,
          config.maxSuggestions,
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback strategy also failed for "${query}":`,
          fallbackError,
        );
        return [];
      }
    }
  }

  private getFallbackSuggestions(query: string): string[] {
    // Last resort: return empty array or basic suggestions
    try {
      const normalizedQuery = this.normalizeQuery(query);
      if (normalizedQuery.length >= 2) {
        return this.trieService.getWordsWithPrefix(
          normalizedQuery.slice(0, 2),
          Math.min(3, this.config.maxSuggestions),
        );
      }
    } catch {
      // Silently fail
    }
    return [];
  }

  private handleError(error: unknown, startTime: bigint): void {
    this.errorCount++;
    this.lastErrorTime = process.hrtime.bigint();
    this.performanceMetrics.errors++;

    const duration = Number(this.lastErrorTime - startTime) / 1_000_000;
    this.logger.error(`Suggestion error (${duration.toFixed(2)}ms):`, error);
  }

  private logPerformanceMetrics(): void {
    const metrics = this.performanceMetrics;
    const avgTime =
      metrics.totalQueries > 0
        ? Number(metrics.totalTime / BigInt(metrics.totalQueries)) / 1_000_000
        : 0;

    this.logger.log(
      `Performance: ${metrics.totalQueries} queries, ` +
        `${avgTime.toFixed(2)}ms avg, ${metrics.cacheHits} cache hits, ` +
        `${metrics.errors} errors`,
    );
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

    const candidates = new Map<string, Candidate>();

    prefixMatches.forEach((word) => {
      candidates.set(word, { word, isPrefixMatch: true });
    });

    // if (prefixMatches.length >= config.maxSuggestions) {
    //   return this.rankCandidates(query, prefixMatches, config).slice(
    //     0,
    //     config.maxSuggestions,
    //   );
    // }

    // Early exit if we have enough high-quality prefix matches
    // if (candidates.size >= config.maxSuggestions) {
    //   return this.rankCandidates(
    //     query,
    //     Array.from(candidates.values()),
    //     config,
    //   );
    // }

    if (candidates.size >= config.maxSuggestions) {
      return this.rankCandidates(
        query,
        Array.from(candidates.values()),
        config,
      ).map((item) => item.candidate);
    }

    // Strategy 2: BK-Tree search for close typo (fast, good recall)
    // const candidates = new Set(prefixMatches);
    const bkResults = this.bkTreeService.search(
      query,
      adaptiveThreshold,
      config.maxTrigramCandidates,
    );
    // bkResults.forEach((word) => candidates.add(word));
    bkResults.forEach(({ word, distance }) => {
      if (!candidates.has(word)) {
        candidates.set(word, {
          word,
          isPrefixMatch: false,
          levenshteinDistance: distance,
        });
      }
    });

    // Early exit if we have enough high-quality candidates
    if (candidates.size >= config.maxSuggestions * 2) {
      const ranked = this.rankCandidates(
        query,
        Array.from(candidates.values()),
        config,
      );
      // if (
      //   ranked.length > 0 &&
      //   this.calculateCompositeScore(query, ranked[0], config) >=
      //     config.earlyExitThreshold
      // ) {
      //   return ranked.slice(0, config.maxSuggestions);
      // }

      // Check the score of the top result directly. No re-calculation needed.
      if (ranked.length > 0 && ranked[0].score >= config.earlyExitThreshold) {
        return ranked
          .slice(0, config.maxSuggestions)
          .map((item) => item.candidate);
      }
    }

    // Strategy 3: Trigram fallback (broader coverage)
    if (candidates.size < config.maxTrigramCandidates) {
      const trigramCandidates = this.trigramIndexService.getTopCandidates(
        query,
        config.maxTrigramCandidates - candidates.size,
        config.minTrigramSimilarity,
      );
      // trigramCandidates.forEach((word) => candidates.add(word));

      // Process the string[] returned from getTopCandidates.
      // The final ranking function will calculate the trigram score.
      trigramCandidates.forEach((word) => {
        if (!candidates.has(word)) {
          candidates.set(word, { word, isPrefixMatch: false });
        }
      });
    }

    // Score and rank all collected candidates
    // return this.rankCandidates(query, Array.from(candidates.values()), config);
    // Final ranking of all collected candidates
    return this.rankCandidates(
      query,
      Array.from(candidates.values()),
      config,
    ).map((item) => item.candidate);
  }

  // private rankCandidates(
  //   query: string,
  //   candidates: Candidate[],
  //   config: SuggestionConfig,
  // ): string[] {
  //   if (candidates.length === 0) return [];

  //   // Use heap for efficient top-k selection
  //   const heap = new MinHeap<{ candidate: string; score: number }>(
  //     (a, b) => a.score - b.score,
  //   );

  //   for (const candidate of candidates) {
  //     const score = this.calculateCompositeScore(query, candidate, config);

  //     if (heap.size() < config.maxSuggestions) {
  //       heap.push({ candidate: candidate.word, score });
  //     } else if (score > heap.peek()!.score) {
  //       heap.pop();
  //       heap.push({ candidate: candidate.word, score });
  //     }
  //   }

  //   return heap
  //     .toSortedArray()
  //     .sort((a, b) => b.score - a.score)
  //     .map((item) => item.candidate);
  // }

  private rankCandidates(
    query: string,
    candidates: Candidate[],
    config: SuggestionConfig,
  ): Array<{ candidate: string; score: number }> {
    if (candidates.length === 0) return [];

    // Use heap for efficient top-k selection
    const heap = new MinHeap<{ candidate: string; score: number }>(
      (a, b) => a.score - b.score,
    );

    for (const candidate of candidates) {
      const score = this.calculateCompositeScore(query, candidate, config);

      if (heap.size() < config.maxSuggestions) {
        heap.push({ candidate: candidate.word, score });
      } else if (score > heap.peek()!.score) {
        heap.pop();
        heap.push({ candidate: candidate.word, score });
      }
    }

    // Return the full sorted array of scored objects
    return heap.toSortedArray().sort((a, b) => b.score - a.score);
  }

  private calculateCompositeScore(
    query: string,
    candidate: Candidate,
    config: SuggestionConfig,
  ): number {
    const word = candidate.word;
    // Prefix bonus
    const prefixBonus =
      candidate.isPrefixMatch ||
      word.toLowerCase().startsWith(query.toLowerCase())
        ? 1
        : 0;

    // Trigram similarity use pre-calculated scores where available, otherwise calculate on the fly
    const trigramSim =
      candidate.trigramScore ??
      this.trigramIndexService.calculateSimilarity(query, word);

    // Levenshtein similarity (normalized to 0-1, higher is better)
    const levDistance =
      candidate.levenshteinDistance ??
      this.levenshteinService.calculateDistance(
        query,
        word,
        config.maxLevenshteinDistance,
      );

    const maxLen = Math.max(query.length, word.length);
    const levSim = maxLen === 0 ? 1 : Math.max(0, 1 - levDistance / maxLen);

    // Length penalty (prefer similar lengths)
    const lengthDiff = Math.abs(query.length - word.length);
    const lengthPenalty = 1 - lengthDiff / maxLen;

    // Frequency bonus (log-scaled to avoid over-weighting)
    const frequencyBonus = Math.min(
      1,
      Math.log1p(this.getWordFrequency(word)) / Math.log(100),
    );

    // Composite score with configurable weights
    return (
      config.trigramWeight * trigramSim +
      config.levenshteinWeight * levSim +
      config.prefixWeight * prefixBonus +
      config.lengthPenaltyWeight * lengthPenalty +
      0.1 * frequencyBonus // Small weight for frequency
      // 0.05 * lengthPenalty // Small bonus for similar length
    );
  }

  private getWordFrequency(word: string): number {
    let node = this.trieService['root']; // Access private root
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) return 0;
      node = node.children.get(char)!;
    }
    return node.isEndOfWord ? node.frequency : 0;
  }

  // private getAdaptiveThreshold(query: string): number {
  //   // Shorter queries need stricter thresholds
  //   if (query.length <= 3) return 1; // Allow 1 typo for very short words
  //   if (query.length <= 5) return 2; // Allow 2 typos for medium words

  //   // Dynamic threshold based on query characteristics
  //   const uniqueChars = new Set(query).size;
  //   const complexity = uniqueChars / query.length;

  //   const threshold = Math.min(
  //     this.config.maxLevenshteinDistance,
  //     Math.floor(query.length * 0.3),
  //   );

  //   // Reduce threshold for repetitive patterns
  //   return complexity < 0.5 ? Math.max(1, threshold - 1) : threshold;
  // }

  private getAdaptiveThreshold(query: string): number {
    // 1. CRITICAL: Short queries need strict thresholds (prevents false positives)
    // if (query.length === 0) return 0;
    // if (query.length <= 3) return 1; // "cat" → 1 typo max
    // if (query.length <= 5) return 2; // "hello" → 2 typos max
    // CRITICAL: Always respect the configured maximum distance
    const length = query.length;
    if (length === 0) return 0;
    if (length === 1) return 0; // No typos for single chars
    if (length === 2) return 1; // Max 1 typo for 2 chars
    if (length <= 4) return Math.min(1, this.config.maxLevenshteinDistance); // Conservative for short words
    if (length <= 7) return Math.min(2, this.config.maxLevenshteinDistance); // Moderate for medium words

    // Handle numeric queries differently
    if (this.isNumericQuery(query)) {
      // Numeric queries need stricter thresholds
      const baseThreshold = Math.min(
        this.config.maxLevenshteinDistance,
        Math.max(1, Math.floor(query.length * 0.15)),
      );

      // Numeric queries rarely benefit from diversity adjustments
      return Math.min(baseThreshold, 2); // Cap at 2 for numeric
    }

    // Use configurable thresholds from config
    const highDiversityThreshold = this.config.highDiversityThreshold;
    const lowDiversityThreshold = this.config.lowDiversityThreshold;
    const diversityAdjustmentStrength = this.config.diversityAdjustmentStrength;
    const lengthThresholdRatio = this.config.lengthThresholdRatio;

    // 2. Base threshold: 30% of length (industry standard for fuzzy search)
    //    Use 0.3 instead of 0.35 for better long-query behavior
    //    Example: 20 chars → 6 → capped to max (usually 3-5 typos, Elasticsearch defaults to ~30%)
    // const baseThreshold = Math.min(
    //   this.config.maxLevenshteinDistance,
    //   Math.floor(query.length * 0.3), // 0.3 is safer than 0.35 for long queries
    // );

    // Calculate length statistics
    const mean = this.queryLengthStats.sum / this.queryLengthStats.count;
    const variance =
      this.queryLengthStats.squares / this.queryLengthStats.count - mean * mean;
    const stdDev = Math.sqrt(variance);
    const zScore = (length - mean) / stdDev;

    // Dynamic threshold based on statistical distribution
    // const baseThreshold = Math.min(
    //   this.config.maxLevenshteinDistance,
    //   Math.max(1, Math.floor(0.3 * length - 0.5 * zScore)),
    // );
    const baseThreshold = Math.min(
      this.config.maxLevenshteinDistance,
      Math.max(1, Math.floor(lengthThresholdRatio * length - 0.5 * zScore)),
    );

    // 3. Diversity adjustment: Unique chars / length (simple & effective)
    // const uniqueChars = new Set(query).size;
    const uniqueChars = this.getUniqueCharCount(query);
    const complexity = uniqueChars / length;

    // Apply smooth, configurable adjustments
    let threshold = baseThreshold;

    // ↑ Allow +1 typo for high-diversity words (e.g., "xenophobia")
    if (complexity > highDiversityThreshold) {
      // High diversity (e.g., >75% unique chars)
      const adjustment =
        diversityAdjustmentStrength *
        Math.min(
          1,
          (complexity - highDiversityThreshold) /
            (1.0 - highDiversityThreshold),
        );
      threshold = Math.min(
        threshold + Math.round(adjustment),
        this.config.maxLevenshteinDistance,
      );
    }
    // ↓ Be stricter for repetitive words (e.g., "zzzzzz")
    else if (complexity < lowDiversityThreshold) {
      // Repetitive (e.g., <35% unique chars)
      const adjustment =
        diversityAdjustmentStrength *
        Math.min(
          1,
          (lowDiversityThreshold - complexity) / lowDiversityThreshold,
        );
      threshold = Math.max(1, threshold - Math.round(adjustment));
    }

    // Check for common patterns that might need special handling
    if (this.hasRepeatingPatterns(query)) {
      threshold = Math.max(1, threshold - 1);
    }

    // 4. Final safety: Never below 1
    return Math.max(1, threshold);
  }

  private hasRepeatingPatterns(query: string): boolean {
    // Simple check for obvious repetitive patterns
    if (query.length < 4) return false;

    // Check for character repetition (e.g., "aaaa", "abab")
    const chars = query.split('');
    let maxRepeat = 1;
    let currentRepeat = 1;

    for (let i = 1; i < chars.length; i++) {
      if (chars[i] === chars[i - 1]) {
        currentRepeat++;
        maxRepeat = Math.max(maxRepeat, currentRepeat);
      } else {
        currentRepeat = 1;
      }
    }

    return maxRepeat >= query.length * 0.4; // 40% repetition threshold
  }

  private getUniqueCharCount(query: string): number {
    // Fast path for very short strings
    if (query.length <= 3) return query.length;

    // Use a fixed-size boolean array for ASCII characters (faster than Set)
    const seen = new Uint8Array(128); // ASCII only
    let count = 0;

    for (let i = 0; i < query.length; i++) {
      const charCode = query.charCodeAt(i);
      if (charCode < 128 && !seen[charCode]) {
        seen[charCode] = 1;
        count++;
      }
    }

    // For non-ASCII or longer strings, fall back to Set
    if (count === 0 || count === query.length) {
      return new Set(query).size;
    }

    return count;
  }

  // Optional: Helper method for testing and debugging
  // getThresholdAnalysis(query: string): {
  //   threshold: number;
  //   baseThreshold: number;
  //   complexity: number;
  //   adjustment: string;
  // } {
  //   const baseThreshold = Math.min(
  //     this.config.maxLevenshteinDistance,
  //     Math.floor(query.length * 0.3),
  //   );

  //   const uniqueChars = new Set(query.toLowerCase()).size;
  //   const complexity = uniqueChars / query.length;

  //   let adjustment = 'none';
  //   let threshold = baseThreshold;

  //   if (query.length <= 3) {
  //     threshold = 1;
  //     adjustment = 'short query (≤3)';
  //   } else if (query.length <= 5) {
  //     threshold = 2;
  //     adjustment = 'short query (≤5)';
  //   } else if (complexity > 0.75) {
  //     threshold = Math.min(threshold + 1, this.config.maxLevenshteinDistance);
  //     adjustment = 'high diversity (+1)';
  //   } else if (complexity < 0.35) {
  //     threshold = Math.max(1, threshold - 1);
  //     adjustment = 'low diversity (-1)';
  //   }

  //   return {
  //     threshold: Math.max(1, threshold),
  //     baseThreshold,
  //     complexity: Math.round(complexity * 100) / 100,
  //     adjustment,
  //   };
  // }

  getThresholdAnalysis(query: string): {
    threshold: number;
    baseThreshold: number;
    complexity: number;
    adjustment: string;
    components: {
      lengthContribution: number;
      diversityContribution: number;
      threshold: number;
    };
  } {
    const length = query.length;

    // Calculate base threshold
    const baseThreshold = Math.min(
      this.config.maxLevenshteinDistance,
      Math.floor(length * this.config.lengthThresholdRatio),
    );

    // Calculate complexity
    const uniqueChars = this.getUniqueCharCount(query);
    const complexity = uniqueChars / length;

    // Calculate adjustments
    let lengthContribution = baseThreshold;
    let diversityContribution = 0;
    let adjustment = 'none';

    if (length <= 3) {
      lengthContribution = Math.min(1, this.config.maxLevenshteinDistance);
      adjustment = `short query (≤3) [capped at ${lengthContribution}]`;
    } else if (length <= 5) {
      lengthContribution = Math.min(2, this.config.maxLevenshteinDistance);
      adjustment = `short query (≤5) [capped at ${lengthContribution}]`;
    } else {
      const highDiversityThreshold = this.config.highDiversityThreshold;
      const lowDiversityThreshold = this.config.lowDiversityThreshold;

      if (complexity > highDiversityThreshold) {
        const adjustmentValue = Math.min(
          1,
          this.config.maxLevenshteinDistance - baseThreshold,
        );
        diversityContribution = adjustmentValue;
        adjustment = `high diversity (+${adjustmentValue.toFixed(1)})`;
      } else if (complexity < lowDiversityThreshold) {
        const adjustmentValue = Math.min(1, baseThreshold - 1);
        diversityContribution = -adjustmentValue;
        adjustment = `low diversity (-${adjustmentValue.toFixed(1)})`;
      }
    }

    const threshold = Math.max(1, lengthContribution + diversityContribution);

    return {
      threshold,
      baseThreshold,
      complexity: Math.round(complexity * 100) / 100,
      adjustment,
      components: {
        lengthContribution,
        diversityContribution,
        threshold,
      },
    };
  }

  private updateQueryStats(query: string, startTime: bigint): void {
    // const responseTime = performance.now() - startTime;
    const responseTime = Number(process.hrtime.bigint() - startTime);
    const length = query.length;
    this.queryLengthStats.sum += length;
    this.queryLengthStats.count++;
    this.queryLengthStats.squares += length * length;
    this.queryLengthStats.lengths.set(
      length,
      (this.queryLengthStats.lengths.get(length) || 0) + 1,
    );
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
    const compressed = this.compressSuggestions(suggestions);
    // Adaptive caching calculate TTL based on query popularity
    const ttl = this.calculateCacheTTL(cacheKey.split('_')[0]);
    // this.cache.set(SUGGESTION_CACHE, cacheKey, suggestions, {
    //   config: {
    //     maxSize: config.cacheSize,
    //     defaultTTL: ttl,
    //     sizeCalculation: (items: string[]) =>
    //       items.reduce((sum, item) => sum + item.length * 2 + 16, 64), // Overhead estimation
    //   },
    // });

    this.cache.set(SUGGESTION_CACHE, cacheKey, compressed, {
      config: {
        maxSize: config.cacheSize,
        defaultTTL: ttl,

        sizeCalculation: (buf: Buffer) => buf.length + 64, // Buffer length + overhead
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

  private generateCacheKey(query: string, config: SuggestionConfig): string {
    // Only include config params that actually affect results
    const relevantConfig = {
      maxSuggestions: config.maxSuggestions,
      minTrigramSimilarity: config.minTrigramSimilarity,
      maxTrigramCandidates: config.maxTrigramCandidates,
      maxLevenshteinDistance: config.maxLevenshteinDistance,
      trigramWeight: config.trigramWeight,
      levenshteinWeight: config.levenshteinWeight,
      prefixWeight: config.prefixWeight,
      lengthPenaltyWeight: config.lengthPenaltyWeight,
    };

    // Create hash of relevant config
    const configHash = this.hashConfig(relevantConfig);
    return `${query}_${configHash}`;
  }

  private hashConfig(payload: unknown): string {
    // 1. Canonical JSON (sorts keys, strips whitespace)
    const canon = JSON.stringify(payload);

    // 2. 64-bit fingerprint → base36
    const raw64 = farmhash.fingerprint64(canon); // returns a Number ≤ 2^64
    return raw64.toString(36); // e.g. "1jf4v2bq1b"
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

    // Optional cold-start: clear everything first to ensure fresh runs between benchmarks
    if (this.config.coldStartBenchmark) {
      this.clearCaches();
      this.queryStats.clear();
    }

    const length = testQueries.length;

    this.logger.log(`Starting benchmark with ${length} queries`);

    const times: number[] = [];
    const errors: string[] = [];
    let cacheHits = 0;

    // Use high-resolution timestamps
    const startTime = process.hrtime.bigint();

    for (const query of testQueries) {
      const queryStart = process.hrtime.bigint();
      const beforeCacheSize = this.getCacheStats().stat.size;

      try {
        this.getSuggestions(query);
      } catch (error) {
        errors.push(
          `${query}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // times.push(process.hrtime.bigint() - queryStart);
      }
      const afterCacheSize = this.getCacheStats().stat.size;

      // If cache size didn't change, it was a cache hit
      if (afterCacheSize === beforeCacheSize) cacheHits++;

      const elapsed = Number(process.hrtime.bigint() - queryStart) / 1e6; // → ms
      times.push(elapsed);
    }

    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    const cacheHitRate = cacheHits / length;
    const errorRate = errors.length / length;
    const throughput = length / (totalTime / 1000); // queries per second

    // sort once
    times.sort((a, b) => Number(a - b));

    // Calculate statistics
    const stats = this.calculateDetailedStats(times);
    // const avgResponseTime =
    //   results.reduce((sum, time) => sum + Number(time), 0) / results.length;
    // const medianResponseTime = Number(results[Math.floor(results.length / 2)]);
    // const p95ResponseTime = Number(results[Math.floor(results.length * 0.95)]);

    const result: BenchmarkResult = {
      avgResponseTime: stats.avgResponseTime,
      medianResponseTime: stats.medianResponseTime,
      p95ResponseTime: stats.p95ResponseTime,
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
      clearCacheMode = 'none', // 'none', 'once' or 'perIteration'
      iterations = 1,
      measureMemory = false,
    } = options;

    if (!this.config.enableBenchmarking) {
      this.logger.warn('Benchmarking is disabled');
      throw new Error('Benchmarking is disabled in configuration');
    }

    const length = testQueries.length;
    this.logger.log(
      `Starting advanced benchmark with ${length} queries, ${iterations} iterations`,
    );

    // Optional cache clearing
    if (clearCacheMode === 'once') {
      this.clearCaches();
      this.queryStats.clear();
      this.logger.log('Caches cleared for cold start benchmark');
    }

    // Optional cache warming
    if (warmCache && clearCacheMode === 'none') {
      await this.warmupCache(testQueries.slice(0, Math.min(100, length)));
      this.logger.log('Cache warmed up');
    }

    const allTimes: number[] = [];
    const iterationStats: DetailedStats[] = [];
    const errors: string[] = [];
    let totalCacheHits = 0;

    // Memory measurement setup
    const memoryBefore = measureMemory ? this.getMemoryUsage() : null;
    const totalStartTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const iterationTimes: number[] = [];
      const iterationStartTime = process.hrtime.bigint();

      if (clearCacheMode === 'perIteration') {
        this.clearCaches();
        this.queryStats.clear();
      }

      for (const query of testQueries) {
        const queryStart = process.hrtime.bigint();
        const beforeCacheSize = this.getCacheStats().stat.size;

        try {
          this.getSuggestions(query);
        } catch (error) {
          errors.push(
            `Iteration ${i}, Query "${query}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        const afterCacheSize = this.getCacheStats().stat.size;

        // If cache size didn't change, it was a cache hit
        if (afterCacheSize === beforeCacheSize) totalCacheHits++;

        const elapsed = Number(process.hrtime.bigint() - queryStart) / 1e6;
        iterationTimes.push(elapsed);
        allTimes.push(elapsed);
      }

      const iterationMs =
        Number(process.hrtime.bigint() - iterationStartTime) / 1e6;
      this.logger.log(
        `Iteration ${i + 1}/${iterations} completed in ${iterationMs.toFixed(2)}ms`,
      );

      iterationStats.push(this.calculateDetailedStats(iterationTimes));
    }

    const totalTime = Number(process.hrtime.bigint() - totalStartTime) / 1e6;
    const memoryAfter = measureMemory ? this.getMemoryUsage() : null;

    // sort once
    allTimes.sort((a, b) => a - b);

    // Calculate comprehensive statistics
    const stats = this.calculateDetailedStats(allTimes);
    const totalQueries = length * iterations;
    const cacheHitRate = totalCacheHits / totalQueries;
    const errorRate = errors.length / totalQueries;
    const throughput = totalQueries / (totalTime / 1000);

    const result: AdvancedBenchmarkResult = {
      ...stats,
      totalQueries,
      totalTime,
      throughput,
      cacheHitRate,
      errorRate,
      iterationStats,
      memoryUsage:
        memoryBefore && memoryAfter
          ? {
              before: memoryBefore,
              after: memoryAfter,
              delta: memoryAfter.heapUsed - memoryBefore.heapUsed,
            }
          : undefined,
      errors: errors.slice(0, 25), // Keep only first 25 errors
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

  // private calculateDetailedStats(times: number[]): DetailedStats {
  //   const sorted = [...times].sort((a, b) => a - b);
  //   const len = sorted.length;

  //   return {
  //     avgResponseTime: times.reduce((sum, time) => sum + time, 0) / len,
  //     medianResponseTime:
  //       len % 2 === 0
  //         ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
  //         : sorted[Math.floor(len / 2)],
  //     p95ResponseTime: sorted[Math.floor(len * 0.95)],
  //     p99ResponseTime: sorted[Math.floor(len * 0.99)],
  //     minResponseTime: sorted[0],
  //     maxResponseTime: sorted[len - 1],
  //     stdDeviation: this.calculateStandardDeviation(times),
  //   };
  // }

  // private calculateStandardDeviation(values: number[]): number {
  //   const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  //   const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  //   const avgSquaredDiff =
  //     squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  //   return Math.sqrt(avgSquaredDiff);
  // }

  // private calculateDetailedStats(times: number[]): DetailedStats {
  //   const sorted = [...times].sort((a, b) => a - b);
  //   const len = sorted.length;

  //   const avgResponseTime = times.reduce((sum, x) => sum + x, 0) / len;
  //   const medianResponseTime =
  //     len % 2 === 0
  //       ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
  //       : sorted[Math.floor(len / 2)];
  //   const p95ResponseTime = sorted[Math.floor(len * 0.95)];
  //   const p99ResponseTime = sorted[Math.floor(len * 0.99)];
  //   const minResponseTime = sorted[0];
  //   const maxResponseTime = sorted[len - 1];
  //   const variance =
  //     times.reduce((sum, x) => sum + (x - avgResponseTime) ** 2, 0) / len;
  //   const stdDeviation = Math.sqrt(variance);

  //   return {
  //     avgResponseTime,
  //     medianResponseTime,
  //     p95ResponseTime,
  //     p99ResponseTime,
  //     minResponseTime,
  //     maxResponseTime,
  //     stdDeviation,
  //   };
  // }

  calculateDetailedStats(times: number[]): DetailedStats {
    const n = times.length;
    if (n === 0) {
      return {
        avgResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        stdDeviation: 0,
      };
    }

    // Phase 1: one-pass for mean, M2 (variance accumulator), min, max
    let avgResponseTime = 0;
    let M2 = 0;
    let minResponseTime = Infinity;
    let maxResponseTime = -Infinity;

    for (let i = 0; i < n; i++) {
      const x = times[i];
      const delta = x - avgResponseTime;
      avgResponseTime += delta / (i + 1);
      M2 += delta * (x - avgResponseTime);

      if (x < minResponseTime) minResponseTime = x;
      if (x > maxResponseTime) maxResponseTime = x;
    }

    // Population variance = M2 / n
    const variance = M2 / n;
    const stdDeviation = Math.sqrt(variance);

    // Phase 2: sort once for median & percentiles
    const sorted = [...times].sort((a, b) => a - b);
    const medianResponseTime =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    const p95ResponseTime = sorted[Math.floor(n * 0.95)];
    const p99ResponseTime = sorted[Math.floor(n * 0.99)];

    return {
      avgResponseTime,
      medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      minResponseTime,
      maxResponseTime,
      stdDeviation,
    };
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
    let currentScore = await this.evaluateConfig(trainingCases, currentConfig);
    let bestConfig = { ...currentConfig };
    let bestScore = currentScore;
    let bestValidationScore = await this.evaluateConfig(
      validationCases,
      bestConfig,
    );

    let temperature = initialTemp;
    let noImprovementCount = 0;
    const maxNoImprovement = 20;

    this.logger.log(
      `Starting auto-tune with ${trainingCases.length} training cases, ${validationCases.length} validation cases`,
    );
    this.logger.log(
      `Initial training score: ${currentScore.toFixed(4)}, validation score: ${bestValidationScore.toFixed(4)}`,
    );

    for (let i = 0; i < maxIterations; i++) {
      const candidateConfig = this.perturbConfig(currentConfig, temperature);
      const candidateScore = await this.evaluateConfig(
        trainingCases,
        candidateConfig,
      );

      // Simulated annealing acceptance criterion
      const accept =
        candidateScore > currentScore ||
        Math.random() < Math.exp((candidateScore - currentScore) / temperature);

      if (accept) {
        currentConfig = candidateConfig;
        currentScore = candidateScore;

        // Check validation score for best config
        const validationScore = await this.evaluateConfig(
          validationCases,
          currentConfig,
        );

        if (validationScore > bestValidationScore) {
          bestConfig = { ...candidateConfig };
          bestScore = candidateScore;
          bestValidationScore = validationScore;
          noImprovementCount = 0;

          this.logger.log(
            `New best config at iteration ${i}: ` +
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
          `Early stopping at iteration ${i} (no improvement for ${maxNoImprovement} iterations)`,
        );
        break;
      }

      // Convergence check
      if (Math.abs(candidateScore - currentScore) < convergenceThreshold) {
        this.logger.log(`Converged at iteration ${i}`);
        break;
      }

      temperature *= coolingRate;

      // Progress logging
      if (i % 10 === 0) {
        this.logger.log(
          `Iteration ${i}: current=${currentScore.toFixed(4)}, best=${bestScore.toFixed(4)}, temp=${temperature.toFixed(3)}`,
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
      // () => {
      //   const totalWeight =
      //     config.trigramWeight + config.levenshteinWeight + config.prefixWeight;
      //   const delta = (Math.random() - 0.5) * 0.3 * perturbationStrength;

      //   newConfig.trigramWeight = this.clamp(
      //     config.trigramWeight + delta,
      //     0.1,
      //     0.7,
      //   );
      //   const remaining = totalWeight - newConfig.trigramWeight;

      //   const levRatio =
      //     config.levenshteinWeight /
      //     (config.levenshteinWeight + config.prefixWeight);
      //   newConfig.levenshteinWeight = remaining * levRatio;
      //   newConfig.prefixWeight = remaining * (1 - levRatio);
      // },
      () => {
        const totalWeight =
          config.trigramWeight +
          config.levenshteinWeight +
          config.prefixWeight +
          config.lengthPenaltyWeight;
        const delta = (Math.random() - 0.5) * 0.3 * perturbationStrength;

        newConfig.trigramWeight = this.clamp(
          config.trigramWeight + delta,
          0.05,
          0.7,
        );
        const remaining = totalWeight - newConfig.trigramWeight;
        const scale =
          remaining /
          (config.levenshteinWeight +
            config.prefixWeight +
            config.lengthPenaltyWeight);

        newConfig.levenshteinWeight = this.clamp(
          config.levenshteinWeight * scale,
          0.05,
          0.7,
        );
        newConfig.prefixWeight = this.clamp(
          config.prefixWeight * scale,
          0.05,
          0.7,
        );
        newConfig.lengthPenaltyWeight = this.clamp(
          config.lengthPenaltyWeight * scale,
          0.05,
          0.7,
        );
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

  // private async evaluateConfig(
  //   testCases: Array<{ query: string; expectedResults: string[] }>,
  // ): Promise<number> {
  //   this.clearCaches();

  //   let totalScore = 0;
  //   const batchSize = 10;

  //   for (let i = 0; i < testCases.length; i += batchSize) {
  //     const batch = testCases.slice(i, i + batchSize);

  //     const batchPromises = batch.map(({ query, expectedResults }) => {
  //       const suggestions = this.getSuggestions(query);
  //       return this.calculateMetrics(suggestions, expectedResults);
  //     });

  //     const batchScores = await Promise.all(batchPromises);
  //     totalScore += batchScores.reduce((sum, score) => sum + score, 0);

  //     // Yield control periodically
  //     if (i % (batchSize * 5) === 0) {
  //       await new Promise((resolve) => setImmediate(resolve));
  //     }
  //   }

  //   return totalScore / testCases.length;
  // }

  private async evaluateConfig(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    config: SuggestionConfig,
    options: {
      batchSize?: number;
      yieldEveryBatches?: number;
      earlyStopThreshold?: number; // e.g. 0.3
      earlyStopAfterFraction?: number; // e.g. 0.2
    } = {},
  ): Promise<number> {
    const {
      batchSize = 20,
      yieldEveryBatches = 5,
      earlyStopThreshold = 0.3,
      earlyStopAfterFraction = 0.2,
    } = options;

    // Reset cache so each config starts clean
    this.clearCaches();

    let totalScore = 0;
    let processed = 0;
    const n = testCases.length;

    while (processed < n) {
      const batch = testCases.slice(processed, processed + batchSize);
      processed += batchSize;

      const scores = await Promise.all(
        batch.map(({ query, expectedResults }) => {
          const suggestions = this.getSuggestions(query, config);
          return this.calculateMetrics(suggestions, expectedResults);
        }),
      );

      totalScore += scores.reduce((sum, score) => sum + score, 0);

      // Early stop on poor performers
      const avgSoFar = totalScore / processed;
      if (
        avgSoFar < earlyStopThreshold &&
        processed >= n * earlyStopAfterFraction
      ) {
        this.logger.debug(
          `Early stop at ${processed}/${n} cases (avg=${avgSoFar.toFixed(2)})`,
        );
        return avgSoFar;
      }

      // Yield periodically to avoid blocking
      if ((processed / batchSize) % yieldEveryBatches === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    return totalScore / n;
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
  // Simple compression for string arrays (40-60% reduction)
  // private compressSuggestions(suggestions: string[]): Buffer {
  //   return Buffer.from(suggestions.join('\x1D'), 'utf-8');
  // }

  // private decompressSuggestions(buffer: Buffer): string[] {
  //   return buffer.toString('utf-8').split('\x1D');
  // }

  // private compressSuggestions(suggestions: string[]): Buffer {
  //   if (suggestions.length === 0) return Buffer.alloc(0);

  //   // Use more efficient separator and encoding
  //   const joined = suggestions.join('\x1F'); // Unit separator
  //   return Buffer.from(joined, 'utf8');
  // }

  // private decompressSuggestions(buffer: Buffer): string[] {
  //   if (buffer.length === 0) return [];
  //   return buffer.toString('utf8').split('\x1F');
  // }

  private compressSuggestions(suggestions: string[]): Buffer {
    if (suggestions.length === 0) {
      return Buffer.alloc(0);
    }

    // Build dictionary + encoded index list
    const dict: string[] = [];
    const encoded: number[] = [];
    for (const suggestion of suggestions) {
      let idx = dict.indexOf(suggestion);
      if (idx === -1) {
        idx = dict.push(suggestion) - 1;
      }
      encoded.push(idx);
    }

    try {
      // encode returns Buffer directly, CBOR is imported as *CBOR
      return CBOR.encode([dict, encoded]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error('Compression error:', err.message);
      } else {
        this.logger.error('Compression error:', String(err));
      }
      // fallback to simple join
      return Buffer.from(suggestions.join('\x1F'), 'utf8');
    }
  }

  private decompressSuggestions(buffer: Buffer): string[] {
    if (buffer.length === 0) return [];

    try {
      const [dict, encoded] = CBOR.decode(buffer) as [string[], number[]];
      return encoded.map((i) => dict[i]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error('Decompression error:', err.message);
      } else {
        this.logger.error('Decompression error:', String(err));
      }
      return buffer.toString('utf8').split('\x1F');
    }
  }

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

  // private shouldFailFast(currentTime: bigint): boolean {
  //   const errorWindow = 15_000_000_000n; // 15 seconds in nanoseconds
  //   const maxErrors = 50;

  //   return (
  //     this.errorCount > maxErrors &&
  //     currentTime - this.lastErrorTime < errorWindow
  //   );
  // }

  private shouldFailFast(currentTime: bigint): boolean {
    const errorWindow = 15_000_000_000; // 15 seconds in nanoseconds
    const maxErrors = 50;

    if (
      this.errorCount > maxErrors / 2 &&
      currentTime - this.lastErrorTime < errorWindow
    ) {
      if (this.errorCount > maxErrors) {
        // Permanent failure mode
        return true;
      }
      return true;
    }

    // Reset error count if last error was long ago
    if (currentTime - this.lastErrorTime > errorWindow * 2) {
      this.errorCount = 0;
    }

    return false;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private isValidQuery(query: string, config: SuggestionConfig): boolean {
    return (
      query.length > 0 &&
      query.length <= config.maxWordsPerNode &&
      !/[^\w\s-']/.test(query)
    ); // Allow only word chars, spaces, hyphens, apostrophes
  }

  private checkRateLimit(query: string, currentTime: bigint): boolean {
    const lastCall = this.queryLimiter.get(query) || BigInt(0);
    const cooldown = 50_000_000n; // 50ms in nanoseconds

    if (currentTime - lastCall < cooldown) {
      return false;
    }

    this.queryLimiter.set(query, currentTime);
    return true;
  }

  private isNumericQuery(query: string): boolean {
    return /^\d+$/.test(query) && query.length >= 4;
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
        // Pass the full candidate object to avoid re-calculating distance
        const breakdown = this.getScoreBreakdown(normalizedQuery, candidate);
        const totalScore = this.calculateCompositeScore(
          normalizedQuery,
          candidate,
          this.config,
        );

        return {
          word: candidate.word,
          score: totalScore,
          breakdown,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxSuggestions);
  }

  // private getAllCandidates(query: string): string[] {
  //   const candidates = new Set<string>();

  //   // Get candidates from all strategies
  //   const prefixMatches = this.trieService.getWordsWithPrefix(query, 50);
  //   const bkResults = this.bkTreeService.search(
  //     query,
  //     this.getAdaptiveThreshold(query),
  //     50,
  //   );
  //   const trigramResults = this.trigramIndexService.getTopCandidates(
  //     query,
  //     50,
  //     this.config.minTrigramSimilarity,
  //   );

  //   prefixMatches.forEach((word) => candidates.add(word));
  //   bkResults.forEach((scoredWord) => candidates.add(scoredWord.word));
  //   trigramResults.forEach((word) => candidates.add(word));

  //   return Array.from(candidates);
  // }

  private getAllCandidates(query: string): Candidate[] {
    const candidates = new Map<string, Candidate>();
    const config = this.config; // Use the service's default config
    const adaptiveThreshold = this.getAdaptiveThreshold(query);

    // Strategy 1: Trie
    const prefixMatches = this.trieService.getWordsWithPrefix(query, 50);
    prefixMatches.forEach((word) =>
      candidates.set(word, { word, isPrefixMatch: true }),
    );

    // Strategy 2: BK-Tree
    const bkResults = this.bkTreeService.search(query, adaptiveThreshold, 50);
    bkResults.forEach(({ word, distance }) => {
      if (!candidates.has(word)) {
        candidates.set(word, {
          word,
          isPrefixMatch: false,
          levenshteinDistance: distance,
        });
      }
    });

    // Strategy 3: Trigram
    const trigramResults = this.trigramIndexService.getTopCandidates(
      query,
      50,
      config.minTrigramSimilarity,
    );
    trigramResults.forEach((word) => {
      if (!candidates.has(word)) {
        candidates.set(word, { word, isPrefixMatch: false });
      }
    });

    return Array.from(candidates.values());
  }

  // private getScoreBreakdown(query: string, candidate: string): ScoreBreakdown {
  //   const prefixMatch = candidate.toLowerCase().startsWith(query.toLowerCase());
  //   const trigramSim = this.trigramIndexService.calculateSimilarity(
  //     query,
  //     candidate,
  //   );

  //   const maxLen = Math.max(query.length, candidate.length);
  //   const levDistance = this.levenshteinService.calculateDistance(
  //     query,
  //     candidate,
  //   );
  //   const levSim = maxLen === 0 ? 1 : Math.max(0, 1 - levDistance / maxLen);

  //   const lengthDiff = Math.abs(query.length - candidate.length);
  //   const lengthSim = 1 - lengthDiff / Math.max(query.length, candidate.length);

  //   return {
  //     prefixMatch,
  //     trigramSimilarity: trigramSim,
  //     levenshteinSimilarity: levSim,
  //     lengthSimilarity: lengthSim,
  //     editDistance: levDistance,
  //   };
  // }

  private getScoreBreakdown(
    query: string,
    candidate: Candidate,
  ): ScoreBreakdown {
    const word = candidate.word.toLowerCase();
    const prefixMatch =
      candidate.isPrefixMatch || word.startsWith(query.toLowerCase());
    const trigramSimilarity = this.trigramIndexService.calculateSimilarity(
      query,
      word,
    );

    // Use the pre-calculated distance if available
    const editDistance =
      candidate.levenshteinDistance ??
      this.levenshteinService.calculateDistance(query, word);

    const maxLen = Math.max(query.length, word.length);
    const levenshteinSimilarity =
      maxLen === 0 ? 1 : Math.max(0, 1 - editDistance / maxLen);

    const lengthDiff = Math.abs(query.length - word.length);
    const lengthSimilarity = 1 - lengthDiff / maxLen;

    return {
      prefixMatch,
      trigramSimilarity,
      levenshteinSimilarity,
      lengthSimilarity,
      editDistance,
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

  // async batchGetSuggestions(
  //   queries: string[],
  //   batchSize: number = 50,
  // ): Promise<Map<string, string[]>> {
  //   const results = new Map<string, string[]>();
  //   const concurrencyLimit = 4; // Adjust based on CPU cores

  //   async function processBatch(batch: string[]): Promise<void> {
  //     const batchResults = await Promise.all(
  //       batch.map((query) =>
  //         this.getSuggestions(query).then(
  //           (s) => [query, s] as [string, string[]],
  //         ),
  //       ),
  //     );
  //     batchResults.forEach(([query, suggestions]) =>
  //       results.set(query, suggestions),
  //     );
  //   }

  //   const batches = [];
  //   for (let i = 0; i < queries.length; i += batchSize) {
  //     batches.push(queries.slice(i, i + batchSize));
  //   }

  //   await Promise.all(
  //     batches
  //       .map((batch, index) =>
  //         new Promise<void>((resolve) => {
  //           setTimeout(
  //             () => processBatch.call(this, batch).then(resolve),
  //             index * 10,
  //           );
  //         }).catch((err) => this.logger.error(`Batch failed: ${err}`)),
  //       )
  //       .slice(0, concurrencyLimit),
  //   );

  //   return results;
  // }

  // =================== ENHANCED MONITORING ===================

  getDetailedSystemStats(): SystemStats & {
    performanceMetrics: PerformanceMetrics;
    levenshteinCacheStats: ReturnType<LevenshteinService['getCacheStats']>;
    memoryUsage?: MemoryUsage;
  } {
    const baseStats = this.getSystemStats();

    return {
      ...baseStats,
      performanceMetrics: { ...this.performanceMetrics },
      levenshteinCacheStats: this.levenshteinService.getCacheStats(),
      memoryUsage: this.getMemoryUsage(),
    };
  }

  private getMemoryUsage(): MemoryUsage | undefined {
    // Node.js specific - replace with appropriate implementation for other environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        total: usage.heapTotal,
        external: usage.external,
      };
    }
    // return undefined;
    // Fallback for non-Node.js environments
    return { heapUsed: 0, total: 0, external: 0 }; // Or throw new Error('Memory usage not supported')
  }

  // Reset performance metrics (useful for testing/monitoring)
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalQueries: 0,
      totalTime: BigInt(0),
      cacheHits: 0,
      errors: 0,
    };
    this.errorCount = 0;
    this.logger.log('Performance metrics reset');
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
