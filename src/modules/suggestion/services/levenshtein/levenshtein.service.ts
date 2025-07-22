import { Injectable } from '@nestjs/common';
import { CacheService } from 'src/modules/cache/services/cache.service';
import { LEVENSHTEIN_CACHE } from 'src/modules/cache/tokens/cache.tokens';

@Injectable()
export class LevenshteinService {
  private maxSize: number;
  constructor(
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

    threshold ??= Math.ceil(Math.max(a.length, b.length) / 3);

    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) => i || j),
    );

    for (let i = 1; i <= b.length; i++) {
      let minRow = Infinity;
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
        minRow = Math.min(minRow, matrix[i][j]);
      }

      if (minRow > threshold) {
        this.cacheService.set(LEVENSHTEIN_CACHE, key, minRow, {
          config: { maxSize: this.maxSize },
        });
        return minRow;
      }
    }

    const distance = matrix[b.length][a.length];
    this.cacheService.set(LEVENSHTEIN_CACHE, key, distance, {
      config: { maxSize: this.maxSize },
    });
    return distance;
  }

  clearCache(): void {
    this.cacheService.clear(LEVENSHTEIN_CACHE);
  }
}
