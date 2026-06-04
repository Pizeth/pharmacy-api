import { Injectable, Logger } from '@nestjs/common';
import { MinHeap } from '../../helpers/min-heap.helper';
import { Trigram, TrigramData } from '../../interfaces/suggestion.interface';

// @Injectable()
// export class TrigramIndexService {
//   private index: Map<string, Set<string>> = new Map();
//   private wordTrigramsOld: Map<string, Set<string>> = new Map();
//   private wordTrigrams = new Map<
//     string,
//     { trigrams: Set<string>; length: number }
//   >();

//   buildIndexOld(words: string[]): void {
//     this.index.clear();
//     this.wordTrigrams.clear();

//     for (const word of words) {
//       const trigrams = this.getTrigrams(word.toLowerCase());
//       this.wordTrigramsOld.set(word.toLowerCase(), trigrams);

//       // Build inverted index
//       for (const trigram of trigrams) {
//         if (!this.index.has(trigram)) {
//           this.index.set(trigram, new Set());
//         }
//         this.index.get(trigram)!.add(word.toLowerCase());
//       }
//     }
//   }

//   buildIndex(words: string[]): void {
//     this.index.clear();
//     this.wordTrigrams.clear();

//     for (const word of words) {
//       const trigrams = this.getTrigrams(word.toLowerCase());
//       this.wordTrigrams.set(word, { trigrams, length: word.length });

//       // Build inverted index
//       for (const trigram of trigrams) {
//         if (!this.index.has(trigram)) {
//           this.index.set(trigram, new Set());
//         }
//         this.index.get(trigram)!.add(word.toLowerCase());
//       }
//     }
//   }

//   private getTrigrams(word: string): Set<string> {
//     const trigrams = new Set<string>();

//     // Add padding for better boundary matching
//     const paddedWord = `  ${word}  `;

//     for (let i = 0; i < paddedWord.length - 2; i++) {
//       trigrams.add(paddedWord.slice(i, i + 3));
//     }
//     return trigrams;
//   }

//   // getCandidates(query: string, minSharedTrigrams: number = 1): Set<string> {
//   //   const queryTrigrams = this.getTrigrams(query.toLowerCase());
//   //   const candidateCounts = new Map<string, number>();

//   //   // Union only relevant trigrams
//   //   for (const trigram of queryTrigrams) {
//   //     this.index.get(trigram)?.forEach((word) => {
//   //       candidateCounts.set(word, (candidateCounts.get(word) || 0) + 1);
//   //     });
//   //   }

//   //   // Filter by minimum shared trigrams
//   //   const candidates = new Set<string>();
//   //   for (const [word, count] of candidateCounts) {
//   //     if (count >= minSharedTrigrams) {
//   //       candidates.add(word);
//   //     }
//   //   }

//   //   return candidates;
//   // }

//   calculateSimilarity(query: string, word: string): number {
//     const queryTrigrams = this.getTrigrams(query.toLowerCase());
//     const wordTrigrams = this.wordTrigramsOld.get(word.toLowerCase());

//     if (!wordTrigrams) return 0;

//     let intersection = 0;
//     for (const trigram of queryTrigrams) {
//       if (wordTrigrams.has(trigram)) intersection++;
//     }

//     const union = queryTrigrams.size + wordTrigrams.size - intersection;
//     return union === 0 ? 0 : intersection / union; // Jaccard similarity
//   }

//   // getTopCandidatesOld(
//   //   query: string,
//   //   maxCandidates: number = 50,
//   //   minSimilarity: number = 0.1,
//   // ): string[] {
//   //   const candidates = this.getCandidates(query, 1);
//   //   if (candidates.size === 0) return [];

//   //   return Array.from(candidates)
//   //     .map((word) => ({
//   //       word,
//   //       similarity: this.calculateSimilarity(query, word),
//   //     }))
//   //     .filter((item) => item.similarity >= minSimilarity)
//   //     .sort((a, b) => b.similarity - a.similarity)
//   //     .slice(0, maxCandidates)
//   //     .map((item) => item.word);
//   // }

//   getTopCandidates(
//     input: string,
//     maxCandidates: number,
//     threshold: number,
//   ): string[] {
//     const inputTrigrams = this.getTrigrams(input.toLowerCase());
//     if (inputTrigrams.size === 0) return [];

//     // 1. Score all candidates (lazy evaluation)
//     const candidateScores = new Map<string, number>();
//     for (const trigram of inputTrigrams) {
//       this.index.get(trigram)?.forEach((word) => {
//         if (!candidateScores.has(word)) {
//           const score = this.calculateScore(input, inputTrigrams, word);
//           candidateScores.set(word, score);
//         }
//       });
//     }

//     // 2. Use min-heap for top-k selection
//     const heap = new MinHeap<{ alias: string; score: number }>(
//       (a, b) => a.score - b.score,
//     );

//     for (const [alias, score] of candidateScores.entries()) {
//       if (score < threshold) continue;

//       if (heap.size() < maxCandidates) {
//         heap.push({ alias, score });
//       } else if (score > heap.peek()!.score) {
//         heap.pop();
//         heap.push({ alias, score });
//       }
//     }

//     // 3. Return results in descending order
//     return heap
//       .toSortedArray()
//       .sort((a, b) => b.score - a.score)
//       .map((item) => item.alias);
//   }

//   private calculateScore(
//     input: string,
//     inputTrigrams: Set<string>,
//     word: string,
//   ): number {
//     const { trigrams, length } = this.wordTrigrams.get(word)!;
//     const matches = this.countMatches(inputTrigrams, trigrams);
//     const similarity = matches / Math.max(trigrams.size, inputTrigrams.size);
//     const lengthPenalty =
//       1 - Math.abs(length - input.length) / Math.max(length, input.length);
//     return similarity * lengthPenalty;
//   }

//   private countMatches(
//     queryTrigrams: Set<string>,
//     wordTrigrams: Set<string>,
//   ): number {
//     let matches = 0;
//     for (const trigram of queryTrigrams) {
//       if (wordTrigrams.has(trigram)) matches++;
//     }
//     return matches;
//   }
// }

@Injectable()
export class TrigramIndexService {
  private readonly context = TrigramIndexService.name;
  private readonly logger = new Logger(this.context);
  private index = new Map<string, Set<string>>();
  private wordTrigrams = new Map<string, Trigram>();
  private readonly trigramPool = new Map<string, Set<string>>(); // Reuse trigram sets

  // buildIndex(words: string[]): void {
  //   const start = performance.now();
  //   this.logger.log(
  //     `TrigramIndexService.buildIndex START (words=${words.length})`,
  //   );
  //   this.index.clear();
  //   this.wordTrigrams.clear();
  //   this.trigramPool.clear();

  //   const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

  //   for (const word of uniqueWords) {
  //     const trigrams = this.buildTrigram(word);

  //     this.wordTrigrams.set(word, trigrams);

  //     // Build inverted index
  //     for (const trigram of trigrams.trigrams) {
  //       if (!this.index.has(trigram)) {
  //         this.index.set(trigram, new Set());
  //       }
  //       this.index.get(trigram)!.add(word);
  //     }
  //   }

  //   this.logger.log(
  //     `TrigramIndexService.buildIndex END (indexSize=${this.index.size}) in ${performance.now() - start}ms`,
  //   );
  // }

  // in TrigramIndexService
  async buildIndex(words: string[]): Promise<void> {
    const start = performance.now();
    this.logger.log(
      `TrigramIndexService.buildIndex START (words=${words.length})`,
    );
    this.index.clear();
    this.wordTrigrams.clear();
    this.trigramPool.clear();

    const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

    const BATCH = Math.max(500, Math.floor(uniqueWords.length / 200) || 500);

    for (let i = 0; i < uniqueWords.length; i++) {
      const word = uniqueWords[i];
      const trigrams = this.buildTrigram(word);
      this.wordTrigrams.set(word, trigrams);

      // Build inverted index
      for (const trigram of trigrams.trigrams) {
        if (!this.index.has(trigram)) this.index.set(trigram, new Set());
        this.index.get(trigram)!.add(word);
      }

      if (i > 0 && i % BATCH === 0) {
        // Yield so main thread is responsive and timers run
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    this.logger.log(
      `TrigramIndexService.buildIndex END (indexSize=${this.index.size}) in ${performance.now() - start}ms`,
    );
  }

  private buildTrigram(word: string): Trigram {
    // 1. Get or build the raw set of padded trigrams
    const trigrams = this.getTrigrams(word);

    // 2. Build a positionMap: trigram → first index in `word`
    const positionMap = new Map<string, number>();
    Array.from(trigrams).forEach((tri) => {
      const idx = word.indexOf(tri.trim()); // trim off padding
      if (idx !== -1 && !positionMap.has(tri)) {
        positionMap.set(tri, idx);
      }
    });

    // 3. Compute the same hash you use for deduplication
    const hash = this.hashTrigrams(trigrams);

    return {
      trigrams,
      length: word.length,
      hash,
      positionMap,
    };
  }

  private getTrigrams(
    word: string,
    minLengthForPadding: number = 4,
  ): Set<string> {
    const key = word;
    if (this.trigramPool.has(key)) {
      return this.trigramPool.get(key)!;
    }

    const trigrams = new Set<string>();

    // Add padding for better boundary matching
    const paddedWord =
      word.length >= minLengthForPadding ? `  ${word}  ` : word;

    for (let i = 0; i < paddedWord.length - 2; i++) {
      trigrams.add(paddedWord.slice(i, i + 3));
    }

    this.trigramPool.set(key, trigrams);
    return trigrams;
  }

  private hashTrigrams(trigrams: Set<string>): number {
    let hash = 0;
    for (const trigram of trigrams) {
      hash = ((hash << 5) - hash + trigram.charCodeAt(0)) | 0;
    }
    return hash;
  }

  getTopCandidates(
    input: string,
    maxCandidates: number,
    threshold: number,
  ): string[] {
    const inputTrigrams = this.getTrigrams(input);
    if (inputTrigrams.size === 0) return [];

    const candidateScores = new Map<string, number>();
    const processedHashes = new Set<number>();

    // 1. Fast hash-based deduplication
    for (const trigram of inputTrigrams) {
      this.index.get(trigram)?.forEach((word) => {
        const wordData = this.wordTrigrams.get(word)!;
        if (processedHashes.has(wordData.hash)) return;

        processedHashes.add(wordData.hash);
        const score = this.calculateAdvancedScore(
          input,
          inputTrigrams,
          wordData,
        );
        if (score >= threshold) {
          candidateScores.set(word, score);
        }
      });
    }

    // 2. Use min-heap for top-k selection
    const heap = new MinHeap<{ word: string; score: number }>(
      (a, b) => a.score - b.score,
    );

    for (const [word, score] of candidateScores) {
      if (score < threshold) continue;

      if (heap.size() < maxCandidates) {
        heap.push({ word, score });
      } else if (score > heap.peek()!.score) {
        heap.pop();
        heap.push({ word, score });
      }
    }

    // 3. Return results in descending order
    return heap
      .toSortedArray()
      .sort((a, b) => b.score - a.score)
      .map((item) => item.word);
  }

  private calculateAdvancedScore(
    input: string,
    inputTrigrams: Set<string>,
    wordData: TrigramData,
  ): number {
    const { trigrams, length, positionMap } = wordData;
    const inputSize = inputTrigrams.size;
    const wordSize = trigrams.size;

    // Position-aware matching with SIMD-like optimization
    let matches = 0;
    let positionBonus = 0;

    // Only iterate over input trigrams ⇒ O(k)
    Array.from(inputTrigrams).forEach((trigram, i) => {
      if (!trigrams.has(trigram)) return;
      matches++;

      // Bonus for trigrams in similar positions
      const wordPos = positionMap.get(trigram);
      if (wordPos !== undefined) {
        const maxLen = Math.max(inputSize, wordSize);
        positionBonus += 1 - Math.abs(i - wordPos) / maxLen;
      }
    });

    if (matches === 0) return 0;

    // Fast Jaccard similarity
    const unionSize = inputSize + wordSize - matches;
    const jaccard = matches / unionSize;

    // Length similarity with sigmoid scaling
    const diff = Math.abs(length - input.length);
    const lengthSimilarity = 1 / (1 + Math.exp(0.5 * (diff - 3)));

    // Position weight
    const positionWeight = positionBonus / matches;

    // Weighted sum
    return jaccard * 0.7 + lengthSimilarity * 0.2 + positionWeight * 0.1;
  }

  calculateSimilarity(query: string, word: string): number {
    const queryTrigrams = this.getTrigrams(query);
    const wordData = this.wordTrigrams.get(word.toLowerCase());

    if (!wordData) return 0;

    return this.calculateAdvancedScore(query, queryTrigrams, wordData);
  }
}

// private calculateAdvancedScore(
//   input: string,
//   inputTrigrams: Set<string>,
//   // word: string,
//   wordData: { trigrams: Set<string>; length: number },
// ): number {
//   const { trigrams, length } = wordData;

//   // Jaccard similarity with position weighting
//   let matches = 0;
//   let positionBonus = 0;

//   const inputArray = Array.from(inputTrigrams);
//   const wordArray = Array.from(trigrams);

//   for (let i = 0; i < inputArray.length; i++) {
//     if (trigrams.has(inputArray[i])) {
//       matches++;
//       // Bonus for trigrams in similar positions
//       const wordPos = wordArray.indexOf(inputArray[i]);
//       if (wordPos !== -1) {
//         positionBonus +=
//           1 -
//           Math.abs(i - wordPos) /
//             Math.max(inputArray.length, wordArray.length);
//       }
//     }
//   }

//   const jaccard = matches / (inputTrigrams.size + trigrams.size - matches);
//   const lengthSimilarity =
//     1 - Math.abs(length - input.length) / Math.max(length, input.length);
//   const positionWeight = positionBonus / matches || 0;

//   return jaccard * 0.7 + lengthSimilarity * 0.2 + positionWeight * 0.1;
// }

// @Injectable()
// export class TrigramIndexService {
//   private index: Map<string, Set<string>> = new Map();
//   // Simplified: `wordTrigramsOld` is removed, all trigram data is in `wordTrigrams`
//   private wordTrigrams = new Map<
//     string,
//     { trigrams: Set<string>; length: number }
//   >();

//   buildIndex(words: string[]): void {
//     this.index.clear();
//     this.wordTrigrams.clear();

//     for (const word of words) {
//       const lowercasedWord = word.toLowerCase(); // Lowercase once
//       const trigrams = this.getTrigrams(lowercasedWord);
//       this.wordTrigrams.set(lowercasedWord, {
//         trigrams,
//         length: lowercasedWord.length,
//       }); // Store lowercased word

//       // Build inverted index
//       for (const trigram of trigrams) {
//         if (!this.index.has(trigram)) {
//           this.index.set(trigram, new Set());
//         }
//         this.index.get(trigram)!.add(lowercasedWord);
//       }
//     }
//   }

//   private getTrigrams(word: string): Set<string> {
//     const trigrams = new Set<string>();
//     const paddedWord = `  ${word}  `; // Add padding for better boundary matching
//     for (let i = 0; i < paddedWord.length - 2; i++) {
//       trigrams.add(paddedWord.slice(i, i + 3));
//     }
//     return trigrams;
//   }

//   /**
//    * Calculates the Jaccard similarity between the query's trigrams and a candidate word's trigrams.
//    * This is a "raw" similarity without length penalty.
//    */
//   calculateJaccardSimilarity(
//     queryTrigrams: Set<string>,
//     candidateWord: string,
//   ): number {
//     const candidateData = this.wordTrigrams.get(candidateWord);
//     if (!candidateData) return 0; // Candidate not found in index

//     const candidateTrigrams = candidateData.trigrams;

//     let intersection = 0;
//     for (const trigram of queryTrigrams) {
//       if (candidateTrigrams.has(trigram)) intersection++;
//     }

//     const union = queryTrigrams.size + candidateTrigrams.size - intersection;
//     return union === 0 ? 0 : intersection / union; // Jaccard similarity
//   }

//   /**
//    * Retrieves top candidate words based on trigram similarity, optionally filtered by length penalty.
//    * This now returns words, not aliases (as 'alias' was removed from this service's mental model).
//    */
//   getTopCandidates(
//     input: string,
//     maxCandidates: number,
//     minSimilarity: number, // Renamed from threshold for clarity with similarity
//   ): string[] {
//     const inputLower = input.toLowerCase();
//     const inputTrigrams = this.getTrigrams(inputLower);
//     if (inputTrigrams.size === 0) return [];

//     // 1. Collect potential candidates and their raw trigram counts
//     const candidateCounts = new Map<string, number>();
//     for (const trigram of inputTrigrams) {
//       this.index.get(trigram)?.forEach((word) => {
//         candidateCounts.set(word, (candidateCounts.get(word) || 0) + 1);
//       });
//     }

//     // 2. Use min-heap for top-k selection based on the full composite score (Jaccard + Length Penalty)
//     const heap = new MinHeap<{ word: string; score: number }>(
//       (a, b) => a.score - b.score,
//     );

//     for (const [word, _count] of candidateCounts.entries()) {
//       const score = this.calculateTrigramCompositeScore(
//         inputLower,
//         inputTrigrams,
//         word,
//       );
//       if (score < minSimilarity) continue; // Filter by minimum overall similarity

//       if (heap.size() < maxCandidates) {
//         heap.push({ word, score });
//       } else if (score > heap.peek()!.score) {
//         heap.pop();
//         heap.push({ word, score });
//       }
//     }

//     // 3. Return results in descending score order
//     return heap
//       .toSortedArray()
//       .sort((a, b) => b.score - a.score)
//       .map((item) => item.word);
//   }

//   /**
//    * Calculates a composite trigram score including Jaccard similarity and a length penalty.
//    * This is now the primary scoring method for trigrams within this service.
//    */
//   private calculateTrigramCompositeScore(
//     inputLower: string,
//     inputTrigrams: Set<string>,
//     candidateWord: string,
//   ): number {
//     const candidateData = this.wordTrigrams.get(candidateWord);
//     if (!candidateData) return 0; // Should not happen if word is in candidateScores

//     const { trigrams: candidateTrigrams, length: candidateLength } =
//       candidateData;

//     // Jaccard Similarity (matches / union)
//     let intersection = 0;
//     for (const trigram of inputTrigrams) {
//       if (candidateTrigrams.has(trigram)) intersection++;
//     }
//     const union = inputTrigrams.size + candidateTrigrams.size - intersection;
//     const jaccardSimilarity = union === 0 ? 0 : intersection / union;

//     // Length Penalty (closer to 1 for similar lengths)
//     const lengthDiff = Math.abs(candidateLength - inputLower.length);
//     const maxLength = Math.max(candidateLength, inputLower.length);
//     const lengthPenalty = maxLength === 0 ? 1 : 1 - lengthDiff / maxLength;

//     // Combine with a simple product (can be weighted if config supports it)
//     // For now, hardcode weights for Trigram-specific composite.
//     // The main SuggestionService's composite score will apply global weights.
//     return jaccardSimilarity * 0.8 + lengthPenalty * 0.2; // Example weights, tune as needed
//   }
// }
