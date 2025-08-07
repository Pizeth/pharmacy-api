// =================== INTERFACES ===================
interface BenchmarkResult {
  avgResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  throughput: number;
  cacheHitRate: number;
  errorRate: number;
}

interface BenchmarkOptions {
  warmCache?: boolean;
  clearCacheFirst?: boolean;
  iterations?: number;
  measureMemory?: boolean;
}

interface DetailedStats {
  avgResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  stdDeviation: number;
}

interface AdvancedBenchmarkResult extends DetailedStats {
  totalQueries: number;
  totalTime: number;
  throughput: number;
  cacheHitRate: number;
  errorRate: number;
  iterationStats: DetailedStats[];
  memoryUsage?: {
    before: MemoryUsage;
    after: MemoryUsage;
    delta: number;
  };
  errors: string[];
}

interface MemoryUsage {
  used: number;
  total: number;
  external: number;
}

interface AutoTuneOptions {
  maxIterations?: number;
  initialTemp?: number;
  coolingRate?: number;
  convergenceThreshold?: number;
  validationSplit?: number;
}

interface SystemStats {
  isWarmedUp: boolean;
  queryStatsSize: number;
  popularQueriesCount: number;
  bkTreeNodeCount: number;
  cacheStats: { stat: CacheStats<unknown>; maxSize: number };
}

interface ScoreBreakdown {
  prefixMatch: boolean;
  trigramSimilarity: number;
  levenshteinSimilarity: number;
  lengthSimilarity: number;
  editDistance: number;
}

export interface PerformanceMetrics {
  totalQueries: number;
  totalTime: bigint;
  cacheHits: number;
  errors: number;
}

export interface Trigram {
  trigrams: Set<string>;
  length: number;
  hash: number;
  positionMap: Map<string, number>;
}

interface TrigramData extends Omit<Trigram, 'hash'> {
  positionMap: Map<string, number>;
}

// A unified type for candidates that carries scores through the pipeline
interface Candidate {
  word: string;
  isPrefixMatch: boolean;
  levenshteinDistance?: number;
  trigramScore?: number;
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
  lengthPenaltyWeight: number; // Added for explicit weighting
  prefixWeight: number; // Bonus for prefix matches

  // Cache configuration
  cacheSize: number;
  maxLocalCacheSize: number; // Default local cache size

  // Benchmarking flag
  enableBenchmarking: boolean;
  coldStartBenchmark: boolean; // Flag for cold start benchmarking

  popularQueryTTLMs: number; // Added for clarity
  frequentQueryTTLMs: number; // Added for clarity
  defaultQueryTTLMs: number; // Added for clarity
  minQueryLength: number; // Added for clarity

  // Performance options
  earlyExitThreshold: number;
  batchProcessingSize: number;
  warmupEnabled: boolean;
  warmpUpSize: number; // Size of the warm-up batch

  // Eviction policy
  maxWordsPerNode: number; // New: max words per TrieNode
}
