import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import { LEVENSHTEIN_CACHE } from 'src/modules/cache/tokens/cache.tokens';
import suggestionConfig from '../../config/suggestion.config';

@Injectable()
export class LevenshteinService {
  private maxSize: number;
  constructor(
    @Inject(suggestionConfig.KEY)
    private config: ConfigType<typeof suggestionConfig>,
    private readonly cacheService: CacheService,
    maxSize: number = 1000,
  ) {
    this.maxSize = maxSize;
    // Initialize cache if needed
  }

  calculateDistance(a: string, b: string, threshold?: number): number {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;

    if (this.cacheService.has(LEVENSHTEIN_CACHE, key)) {
      return this.cacheService.get<number>(LEVENSHTEIN_CACHE, key)!;
    }

    // Matrix-free implementation with early exit
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    // Length difference shortcut
    const lengthDiff = Math.abs(a.length - b.length);
    if (lengthDiff > this.config.maxLevenshteinDistance) {
      return lengthDiff;
    }

    threshold ??= Math.ceil(Math.max(a.length, b.length) / 3);

    // Use two rows instead of full matrix
    let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
    let currentRow = new Array<number>(b.length + 1);

    for (let i = 0; i < a.length; i++) {
      currentRow[0] = i + 1;
      let minRow = Infinity;
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        currentRow[j + 1] = Math.min(
          currentRow[j] + 1, // Deletion
          prevRow[j + 1] + 1, // Insertion
          prevRow[j] + cost, // Substitution
        );
        minRow = Math.min(minRow, currentRow[j + 1]);
      }

      if (minRow > threshold) {
        this.cacheService.set(LEVENSHTEIN_CACHE, key, minRow, {
          config: { maxSize: this.maxSize },
        });
        return minRow;
      }

      // Swap rows for next iteration
      [prevRow, currentRow] = [currentRow, prevRow];
    }

    const distance = prevRow[b.length];
    this.cacheService.set(LEVENSHTEIN_CACHE, key, distance, {
      config: { maxSize: this.maxSize },
    });
    return distance;
  }
}

// const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
//   Array.from({ length: a.length + 1 }, (_, j) => i || j),
// );

// for (let i = 1; i <= b.length; i++) {
//   let minRow = Infinity;
//   for (let j = 1; j <= a.length; j++) {
//     const cost = a[j - 1] === b[i - 1] ? 0 : 1;
//     matrix[i][j] = Math.min(
//       matrix[i - 1][j] + 1, // Deletion
//       matrix[i][j - 1] + 1, // Insertion
//       matrix[i - 1][j - 1] + cost, // Substitution
//     );
//     minRow = Math.min(minRow, matrix[i][j]);
//   }

//   if (minRow > threshold) {
//     this.cacheService.set(LEVENSHTEIN_CACHE, key, minRow, {
//       config: { maxSize: this.maxSize },
//     });
//     return minRow;
//   }
// }

// const distance = matrix[b.length][a.length];
// this.cacheService.set(LEVENSHTEIN_CACHE, key, distance, {
//   config: { maxSize: this.maxSize },
// });
// return distance;
