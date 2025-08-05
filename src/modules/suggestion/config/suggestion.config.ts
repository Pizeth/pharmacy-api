import { registerAs } from '@nestjs/config';
import { SuggestionConfig } from '../interfaces/suggestion.interface';

// export default registerAs(
//   'suggestion',
//   (): SuggestionConfig => ({
//     minTrigramSimilarity: parseFloat(
//       process.env.MIN_TRIGRAM_SIMILARITY ?? '0.25',
//     ),
//     maxTrigramCandidates: parseInt(process.env.MAX_TRIGRAM_CANDIDATES ?? '100'),
//     maxLevenshteinDistance: parseInt(
//       process.env.MAX_LEVENSHTEIN_DISTANCE ?? '3',
//     ),
//     maxSuggestions: parseInt(process.env.MAX_SUGGESTIONS ?? '5'),
//     trigramWeight: parseFloat(process.env.TRIGRAM_WEIGHT ?? '0.3'),
//     levenshteinWeight: parseFloat(process.env.LEVENSHTEIN_WEIGHT ?? '0.6'),
//     prefixWeight: parseFloat(process.env.PREFIX_WEIGHT ?? '0.1'),
//     cacheSize: parseInt(process.env.SUGGESTION_CACHE_SIZE ?? '2000'),
//     enableBenchmarking: process.env.ENABLE_BENCHMARKING === 'true',
//     coldStartBenchmark: process.env.COLD_START_BENCHMARK === 'fasle',
//     earlyExitThreshold: parseFloat(process.env.EARLY_EXIT_THRESHOLD ?? '0.95'),
//     batchProcessingSize: parseInt(process.env.BATCH_PROCESSING_SIZE ?? '100'),
//     warmupEnabled: process.env.WARMUP_ENABLED !== 'false',
//     lengthPenaltyWeight: parseFloat(
//       process.env.LENGTH_PENALTY_WEIGHT ?? '0.05',
//     ),
//     maxLocalCacheSize: parseInt(process.env.MAX_LOCAL_CACHE_SIZE ?? '500'),
//     popularQueryTTLMs: parseInt(process.env.POPULAR_QUERY_TTL_MS ?? '7200_000'),
//     frequentQueryTTLMs: parseInt(
//       process.env.FREQUENT_QUERY_TTL_MS ?? '1800_000',
//     ),
//     defaultQueryTTLMs: parseInt(process.env.DEFAULT_QUERY_TTL_MS ?? '300_000'),
//     minQueryLength: parseInt(process.env.MIN_QUERY_LENGTH ?? '3'),
//     wampUpSize: parseInt(process.env.WAMP_UP_SIZE ?? '500'),
//     maxWordsPerNode: parseInt(process.env.MAX_WORDS_PER_NODE ?? '50'),
//   }),
// );

export default registerAs('suggestion', (): SuggestionConfig => {
  const cfg = {
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
    coldStartBenchmark: process.env.COLD_START_BENCHMARK === 'true',
    earlyExitThreshold: parseFloat(process.env.EARLY_EXIT_THRESHOLD ?? '0.95'),
    batchProcessingSize: parseInt(process.env.BATCH_PROCESSING_SIZE ?? '100'),
    warmupEnabled: process.env.WARMUP_ENABLED !== 'false',
    lengthPenaltyWeight: parseFloat(
      process.env.LENGTH_PENALTY_WEIGHT ?? '0.05',
    ),
    maxLocalCacheSize: parseInt(process.env.MAX_LOCAL_CACHE_SIZE ?? '500'),
    popularQueryTTLMs: parseInt(process.env.POPULAR_QUERY_TTL_MS ?? '7200_000'),
    frequentQueryTTLMs: parseInt(
      process.env.FREQUENT_QUERY_TTL_MS ?? '1800_000',
    ),
    defaultQueryTTLMs: parseInt(process.env.DEFAULT_QUERY_TTL_MS ?? '300_000'),
    minQueryLength: parseInt(process.env.MIN_QUERY_LENGTH ?? '3'),
    warmpUpSize: parseInt(process.env.WAMP_UP_SIZE ?? '500'),
    maxWordsPerNode: parseInt(process.env.MAX_WORDS_PER_NODE ?? '50'),
  };

  // Validation: weights should sum to 1 including all weights
  const totalWeight =
    cfg.trigramWeight +
    cfg.levenshteinWeight +
    cfg.prefixWeight +
    cfg.lengthPenaltyWeight;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error(
      `[suggestion] All weights must sum to 1.0, got ${totalWeight.toFixed(3)}. ` +
        `Current: trigram=${cfg.trigramWeight}, levenshtein=${cfg.levenshteinWeight}, ` +
        `prefix=${cfg.prefixWeight}, lengthPenalty=${cfg.lengthPenaltyWeight}`,
    );
  }

  return cfg;
});
