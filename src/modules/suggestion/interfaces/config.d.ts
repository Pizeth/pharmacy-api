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
}
