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

  // New performance options
  earlyExitThreshold: number;
  batchProcessingSize: number;
  warmupEnabled: boolean;
}

export interface Trigram {
  trigrams: Set<string>;
  length: number;
  hash: number;
}
