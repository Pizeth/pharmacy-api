import { Logger } from '@nestjs/common';
import {
  AutoTuneOptions,
  SuggestionConfig,
} from '../interfaces/suggestion.interface';

export class ConfigOptimizer {
  private readonly logger = new Logger(ConfigOptimizer.name);
  constructor(private initial: SuggestionConfig) {}

  async optimize(
    testCases: Array<{ query: string; expectedResults: string[] }>,
    options: AutoTuneOptions,
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

    let currentConfig = { ...this.initial };
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

    for (let i = 0; i < maxIterations; i++) {
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
    return bestConfig;
  }

  // =================== AUTO-TUNING ===================

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
}
