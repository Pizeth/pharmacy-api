import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import { LEVENSHTEIN_CACHE } from 'src/modules/cache/tokens/cache.tokens';
import suggestionConfig from '../../configs/suggestion.config';

// @Injectable()
// export class LevenshteinService {
//   private maxSize: number;
//   constructor(
//     @Inject(suggestionConfig.KEY)
//     private config: ConfigType<typeof suggestionConfig>,
//     private readonly cacheService: CacheService,
//     maxSize: number = 1000,
//   ) {
//     this.maxSize = maxSize;
//     // Initialize cache if needed
//   }

//   calculateDistance(a: string, b: string, threshold?: number): number {
//     const key = a < b ? `${a}|${b}` : `${b}|${a}`;

//     if (this.cacheService.has(LEVENSHTEIN_CACHE, key)) {
//       return this.cacheService.get<number>(LEVENSHTEIN_CACHE, key)!;
//     }

//     // Matrix-free implementation with early exit
//     if (!a.length) return b.length;
//     if (!b.length) return a.length;

//     // Length difference shortcut
//     const lengthDiff = Math.abs(a.length - b.length);
//     if (lengthDiff > this.config.maxLevenshteinDistance) {
//       return lengthDiff;
//     }

//     threshold ??= Math.ceil(Math.max(a.length, b.length) / 3);

//     // Use two rows instead of full matrix
//     let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
//     let currentRow = new Array<number>(b.length + 1);

//     for (let i = 0; i < a.length; i++) {
//       currentRow[0] = i + 1;
//       let minRow = Infinity;
//       for (let j = 0; j < b.length; j++) {
//         const cost = a[i] === b[j] ? 0 : 1;
//         currentRow[j + 1] = Math.min(
//           currentRow[j] + 1, // Deletion
//           prevRow[j + 1] + 1, // Insertion
//           prevRow[j] + cost, // Substitution
//         );
//         minRow = Math.min(minRow, currentRow[j + 1]);
//       }

//       if (minRow > threshold) {
//         this.cacheService.set(LEVENSHTEIN_CACHE, key, minRow, {
//           config: { maxSize: this.maxSize },
//         });
//         return minRow;
//       }

//       // Swap rows for next iteration
//       [prevRow, currentRow] = [currentRow, prevRow];
//     }

//     const distance = prevRow[b.length];
//     this.cacheService.set(LEVENSHTEIN_CACHE, key, distance, {
//       config: { maxSize: this.maxSize },
//     });
//     return distance;
//   }
// }

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

@Injectable()
export class LevenshteinService {
  private localCache = new Map<string, number>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    @Inject(suggestionConfig.KEY)
    private config: ConfigType<typeof suggestionConfig>,
    private readonly cacheService: CacheService,
  ) {
    console.log('[BOOT] LevenshteinService constructor');
  }

  /**
   * Compute Levenshtein distance with adaptive algorithm choice.
   *
   * @param a                   Pattern string
   * @param b                   Text string
   * @param threshold           Maximum acceptable distance
   * @param maxMyersPatternLen  Use Myers if a.length ≤ this (default: 64)
   * @returns                   Exact distance or a value > threshold
   */
  getDistance(
    a: string,
    b: string,
    threshold: number,
    maxMyersPatternLen = 64,
  ): number {
    if (a.length <= maxMyersPatternLen) {
      return this.myersLevenshtein(a, b, threshold);
    }
    return this.calculateDistance(a, b, threshold);
  }

  /**
   * Compute Levenshtein distance using Myers’ bit-parallel algorithm.
   * Returns actual distance, or a value > threshold if it exceeds that.
   *
   * Requirements:
   * - pattern length ≤ 64 characters (one 64-bit BigInt word).
   * - BigInt support (Node.js ≥10.4 or modern browsers).
   *
   * @param a         Pattern string (length m)
   * @param b         Text   string (length n)
   * @param threshold Maximum distance to compute before early exit
   */
  myersLevenshtein(a: string, b: string, threshold: number): number {
    const m = a.length;
    const n = b.length;

    // If pattern too long, fall back to classic DP (or split into chunks)
    if (m === 0) return n;
    if (n === 0) return m;
    if (m > 64) {
      // Simple DP fallback (no threshold optimization shown here)
      let prev = [...Array(n + 1).keys()];
      let curr = new Array<number>(n + 1);
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
      }
      return prev[n];
    }

    // 1) Build Eq bitmasks: Eq[c] has 1s where pattern-char == c
    const Eq = new Map<string, bigint>();
    for (let i = 0; i < m; i++) {
      const ch = a[i];
      const bit = 1n << BigInt(i);
      Eq.set(ch, (Eq.get(ch) || 0n) | bit);
    }

    // 2) Initialize bit-vectors
    let VP = ~0n; // all 1s
    let VN = 0n; // all 0s
    let currDist = m; // initial distance = pattern length
    const highBit = 1n << BigInt(m - 1); // mask to extract bit m-1

    // 3) Process each character of b
    for (let j = 0; j < n; j++) {
      const charMask = Eq.get(b[j]) || 0n;

      // Algorithm core (Myers 1999)
      const X = charMask | VN;
      const D0 = (((X & VP) + VP) ^ VP) | X;
      const HP = VN | ~(D0 | VP);
      const HN = VP & D0;

      // Extract carry-out bits to adjust currDist
      const carryIn = (HP & highBit) !== 0n ? 1 : 0;
      const carryOut = (HN & highBit) !== 0n ? 1 : 0;
      currDist += carryIn - carryOut;

      // Early exit if beyond threshold
      if (currDist > threshold) {
        return currDist;
      }

      // Shift for next iteration
      const shiftedHP = (HP << 1n) | 1n;
      const shiftedHN = HN << 1n;
      VP = shiftedHN | ~(D0 | shiftedHP);
      VN = shiftedHP & D0;
    }

    return currDist;
  }

  /**
   * Calculates the Levenshtein distance between two strings, optionally using a threshold to limit computation.
   * Utilizes both a local and distributed cache to optimize repeated calculations.
   *
   * @param a - The first string to compare.
   * @param b - The second string to compare.
   * @param threshold - Optional maximum distance to compute before early exit. Defaults to `this.config.maxLevenshteinDistance`.
   * @returns The Levenshtein distance between `a` and `b`. If the distance exceeds the threshold, returns the length difference.
   *
   * @remarks
   * - If the strings are equal, returns 0.
   * - If the length difference exceeds the configured maximum distance or threshold, returns the length difference.
   * - Results are cached locally and in a distributed cache for performance.
   * - Local cache is periodically pruned to maintain a maximum size.
   */
  calculateDistance(a: string, b: string, threshold?: number): number {
    // Quick equality check
    if (a === b) return 0;

    // // const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    // const key = [a, b].sort().join('|');

    if (!a.length) return b.length;
    if (!b.length) return a.length;

    // Swap to ensure a is shorter (optimization)
    if (a.length > b.length) [a, b] = [b, a];

    const key = `${a}|${b}`; // Simpler key since a is always shorter
    threshold ??= this.config.maxLevenshteinDistance;

    // Length difference optimization
    const lengthDiff = Math.abs(a.length - b.length);
    if (lengthDiff > threshold) {
      this.cacheResult(key, lengthDiff);
      return lengthDiff;
    }

    // Check local cache first (faster than distributed cache)
    if (this.localCache.has(key)) {
      this.cacheHits++;
      return this.localCache.get(key)!;
    }

    // Check distributed cache
    if (this.cacheService.has(LEVENSHTEIN_CACHE, key)) {
      const distance = this.cacheService.get<number>(LEVENSHTEIN_CACHE, key)!;
      this.localCache.set(key, distance);
      this.cacheHits++;
      return distance;
    }

    this.cacheMisses++;
    const distance = this.computeDistance(a, b, threshold);
    this.cacheResult(key, distance);
    return distance;
  }

  // private computeDistance(a: string, b: string, threshold: number): number {
  //   const m = a.length;
  //   const n = b.length;

  //   let prev = [...Array(n + 1).keys()],
  //     curr = new Array<number>(n + 1);
  //   // if |m - n| <= 1, inner loop checks only j∈[i-1,i+1], else full n loop
  //   const smallDelta = Math.abs(m - n) <= 1;
  //   for (let i = 0; i < m; i++) {
  //     curr[0] = i + 1;
  //     let rowMin = curr[0];
  //     const start = smallDelta ? Math.max(0, i - 1) : 0;
  //     const end = smallDelta ? Math.min(n, i + 1) : n;
  //     for (let j = start; j < end; j++) {
  //       const cost = a[i] === b[j] ? 0 : 1;
  //       curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
  //       rowMin = Math.min(rowMin, curr[j + 1]);
  //     }
  //     if (rowMin > threshold) return rowMin;

  //     // Swap rows for next iteration
  //     [prev, curr] = [curr, prev];
  //   }
  //   return prev[n];
  // }

  // More optimized distance calculation
  // private computeOptimizedDistance(
  //   a: string,
  //   b: string,
  //   threshold: number,
  // ): number {
  //   const m = a.length;
  //   const n = b.length;

  //   // Use single array with rolling updates (space optimization)
  //   let prev = new Array<number>(n + 1);
  //   let curr = new Array<number>(n + 1);

  //   // Initialize first row
  //   for (let j = 0; j <= n; j++) prev[j] = j;

  //   for (let i = 1; i <= m; i++) {
  //     curr[0] = i;
  //     let minInRow = i;

  //     // Bounded search window optimization
  //     const start = Math.max(1, i - threshold);
  //     const end = Math.min(n, i + threshold);

  //     for (let j = start; j <= end; j++) {
  //       const cost = a[i - 1] === b[j - 1] ? 0 : 1;
  //       curr[j] = Math.min(
  //         curr[j - 1] + 1, // insertion
  //         prev[j] + 1, // deletion
  //         prev[j - 1] + cost, // substitution
  //       );
  //       minInRow = Math.min(minInRow, curr[j]);
  //     }

  //     // Early termination if row minimum exceeds threshold
  //     if (minInRow > threshold) return minInRow;

  //     [prev, curr] = [curr, prev];
  //   }

  //   return prev[n];
  // }

  /**
   * Banded Levenshtein with early exits and minimal memory.
   * - Always loops over the shorter string for array size m.
   * - Returns actual distance or a value > threshold if it overruns.
   */
  private computeDistance(a: string, b: string, threshold: number): number {
    // 1) Ensure `a` is the shorter string to minimize array size
    if (a.length > b.length) [a, b] = [b, a];

    const m = a.length;
    const n = b.length;

    // 2) Quick bail when length difference already exceeds threshold
    if (n - m > threshold) return n - m;

    // 3) Rolling arrays of size m+1 (space optimization)
    const prev = new Array<number>(m + 1);
    const curr = new Array<number>(m + 1);

    // Initialize row 0 → [0,1,2,…,m]
    for (let i = 0; i <= m; i++) prev[i] = i;

    // 4) Main DP: iterate over b (length n)
    for (let j = 1; j <= n; j++) {
      curr[0] = j;
      let rowMin = curr[0];

      // 5) Only compute within the diagonal band [j-threshold … j+threshold]
      const start = Math.max(1, j - threshold);
      const end = Math.min(m, j + threshold);

      // Fill cells inside the band
      for (let i = start; i <= end; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[i] = Math.min(
          curr[i - 1] + 1, // insertion
          prev[i] + 1, // deletion
          prev[i - 1] + cost, // substitution
        );
        rowMin = Math.min(rowMin, curr[i]);
      }

      // 6) If every cell in the band is > threshold, we can quit early
      if (rowMin > threshold) return rowMin;

      // 7) Swap buffers for next iteration
      for (let i = start; i <= end; i++) {
        prev[i] = curr[i];
      }
    }

    // 8) Final distance is at prev[m]
    return prev[m];
  }

  private cacheResult(key: string, distance: number) {
    // // Cache management
    // if (this.localCache.size >= this.maxLocalCacheSize) {
    //   // Remove 20% of oldest entries
    //   const keysToRemove = Array.from(this.localCache.keys()).slice(
    //     0,
    //     Math.floor(this.maxLocalCacheSize * 0.2),
    //   );
    //   keysToRemove.forEach((k) => this.localCache.delete(k));
    // }

    // LRU eviction for local cache
    if (this.localCache.size >= this.config.maxLocalCacheSize) {
      // Remove oldest entry (Map preserves insertion order)
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.localCache.delete(oldestKey);
      }
    }

    this.localCache.set(key, distance);
    this.cacheService.set(LEVENSHTEIN_CACHE, key, distance, {
      config: { maxSize: this.config.cacheSize },
    });
  }

  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }
}

// private computeDistance(a: string, b: string, threshold: number): number {
//   // Matrix-free implementation with early exit
//   if (!a.length) return b.length;
//   if (!b.length) return a.length;

//   // Use diagonal optimization for similar-length strings
//   if (Math.abs(a.length - b.length) <= 1) {
//     return this.computeDiagonal(a, b, threshold);
//   }

//   return this.computeStandard(a, b, threshold);
// }

// private computeDiagonal(a: string, b: string, threshold: number): number {
//   const maxLen = Math.max(a.length, b.length);
//   let prevRow = Array.from({ length: maxLen + 1 }, (_, i) => i);
//   let currRow = new Array<number>(maxLen + 1);

//   for (let i = 0; i < maxLen; i++) {
//     currRow[0] = i + 1;
//     let minRowValue = currRow[0];

//     for (let j = 0; j < maxLen; j++) {
//       const cost = i < a.length && j < b.length && a[i] === b[j] ? 0 : 1;
//       currRow[j + 1] = Math.min(
//         currRow[j] + 1, // Deletion
//         prevRow[j + 1] + 1, // Insertion
//         prevRow[j] + cost, // Substitution
//       );
//       minRowValue = Math.min(minRowValue, currRow[j + 1]);
//     }

//     if (minRowValue > threshold) return minRowValue;

//     // Swap rows for next iteration
//     [prevRow, currRow] = [currRow, prevRow];
//   }

//   return prevRow[maxLen];
// }

// private computeStandard(a: string, b: string, threshold: number): number {
//   let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
//   let currRow = new Array<number>(b.length + 1);

//   for (let i = 0; i < a.length; i++) {
//     currRow[0] = i + 1;
//     let minRowValue = currRow[0];

//     for (let j = 0; j < b.length; j++) {
//       const cost = a[i] === b[j] ? 0 : 1;
//       currRow[j + 1] = Math.min(
//         currRow[j] + 1, // Deletion
//         prevRow[j + 1] + 1, // Insertion
//         prevRow[j] + cost, // Substitution
//       );
//       minRowValue = Math.min(minRowValue, currRow[j + 1]);
//     }

//     if (minRowValue > threshold) return minRowValue;

//     // Swap rows for next iteration
//     [prevRow, currRow] = [currRow, prevRow];
//   }

//   return prevRow[b.length];
// }
