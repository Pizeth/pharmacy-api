// src/utils/levenshtein/levenshtein.utils.ts
export class LevenshteinUtils {
  /**
   * Calculate the Levenshtein distance between two strings with dynamic thresholding
   */
  static levenshteinDistance(a: string, b: string, threshold?: number): number {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const cache = new Map<string, number>();

    if (cache.has(key)) return cache.get(key)!;

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
        cache.set(key, minRow);
        return minRow;
      }
    }

    const distance = matrix[b.length][a.length];
    cache.set(key, distance);
    return distance;
  }
}
