import { registerAs } from '@nestjs/config';
import { SuggestionConfig } from '../interfaces/suggestion.interface';

// export interface SuggestionConfig {
//   // Trigram filtering
//   minTrigramSimilarity: number;
//   maxTrigramCandidates: number;

//   // Levenshtein thresholds
//   maxLevenshteinDistance: number;

//   // Output limits
//   maxSuggestions: number;

//   // Strategy weights (0-1, should sum to 1)
//   trigramWeight: number;
//   levenshteinWeight: number;

//   // Cache configuration
//   cacheSize: number;

//   // Benchmarking flag
//   enableBenchmarking: boolean;
// }

// export default registerAs(
//   'suggestion',
//   (): SuggestionConfig => ({
//     minTrigramSimilarity: parseFloat(
//       process.env.MIN_TRIGRAM_SIMILARITY ?? '0.3',
//     ),
//     maxTrigramCandidates: parseInt(process.env.MAX_TRIGRAM_CANDIDATES ?? '50'),
//     maxLevenshteinDistance: parseInt(
//       process.env.MAX_LEVENSHTEIN_DISTANCE ?? '3',
//     ),
//     maxSuggestions: parseInt(process.env.MAX_SUGGESTIONS ?? '5'),
//     trigramWeight: parseFloat(process.env.TRIGRAM_WEIGHT ?? '0.3'),
//     levenshteinWeight: parseFloat(process.env.LEVENSHTEIN_WEIGHT ?? '0.7'),
//     cacheSize: parseInt(process.env.SUGGESTION_CACHE_SIZE ?? '1000'),
//     enableBenchmarking: process.env.ENABLE_BENCHMARKING === 'true',
//   }),
// );

export default registerAs(
  'suggestion',
  (): SuggestionConfig => ({
    minTrigramSimilarity: parseFloat(
      process.env.MIN_TRIGRAM_SIMILARITY ?? '0.25',
    ),
    maxTrigramCandidates: parseInt(process.env.MAX_TRIGRAM_CANDIDATES ?? '100'),
    maxLevenshteinDistance: parseInt(
      process.env.MAX_LEVENSHTEIN_DISTANCE ?? '3',
    ),
    maxSuggestions: parseInt(process.env.MAX_SUGGESTIONS ?? '5'),
    trigramWeight: parseFloat(process.env.TRIGRAM_WEIGHT ?? '0.3'),
    levenshteinWeight: parseFloat(process.env.LEVENSHTEIN_WEIGHT ?? '0.6'),
    prefixWeight: parseFloat(process.env.PREFIX_WEIGHT ?? '0.1'),
    cacheSize: parseInt(process.env.SUGGESTION_CACHE_SIZE ?? '2000'),
    enableBenchmarking: process.env.ENABLE_BENCHMARKING === 'true',
    earlyExitThreshold: parseFloat(process.env.EARLY_EXIT_THRESHOLD ?? '0.95'),
    batchProcessingSize: parseInt(process.env.BATCH_PROCESSING_SIZE ?? '100'),
    warmupEnabled: process.env.WARMUP_ENABLED !== 'false',
  }),
);
