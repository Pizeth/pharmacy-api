// =================== INTERFACES ===================
export interface BenchmarkResult {
  avgResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  throughput: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface AutoTuneOptions {
  maxIterations?: number;
  initialTemp?: number;
  coolingRate?: number;
  convergenceThreshold?: number;
  validationSplit?: number;
}

export interface SystemStats {
  isWarmedUp: boolean;
  queryStatsSize: number;
  popularQueriesCount: number;
  bkTreeNodeCount: number;
  cacheStats: { stat: CacheStats<unknown>; maxSize: number };
}

export interface ScoreBreakdown {
  prefixMatch: boolean;
  trigramSimilarity: number;
  levenshteinSimilarity: number;
  lengthSimilarity: number;
  editDistance: number;
}

export interface Trigram {
  trigrams: Set<string>;
  length: number;
  hash: number;
}

// =================== CONFIG ===================
export interface SuggestionConfig {
  // Trigram filtering
  minTrigramSimilarity: number;
  maxTrigramCandidates: number;

  // Levenshtein thresholds
  maxLevenshteinDistance: number;

  // Output limits
  maxSuggestions: number;

  // Strategy weights (0-1, should sum to 1)
  trigramWeight: number;
  levenshteinWeight: number;
  prefixWeight: number; // New: bonus for prefix matches

  // Cache configuration
  cacheSize: number;

  // Benchmarking flag
  enableBenchmarking: boolean;

  // Performance options
  earlyExitThreshold: number;
  batchProcessingSize: number;
  warmupEnabled: boolean;

  // Eviction policy
  maxWordsPerNode: number; // New: max words per TrieNode
}
