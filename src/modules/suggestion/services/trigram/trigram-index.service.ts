import { Injectable } from '@nestjs/common';
import { MinHeap } from '../../helpers/min-heap.helper';
import { Trigram } from '../../interfaces/suggestion.interface';

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
  private index = new Map<string, Set<string>>();
  private wordTrigrams = new Map<string, Trigram>();
  private readonly trigramPool = new Map<string, Set<string>>(); // Reuse trigram sets

  buildIndex(words: string[]): void {
    this.index.clear();
    this.wordTrigrams.clear();
    this.trigramPool.clear();

    const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

    for (const word of uniqueWords) {
      const trigrams = this.buildTrigram(word);

      this.wordTrigrams.set(word, trigrams);

      // Build inverted index
      for (const trigram of trigrams.trigrams) {
        if (!this.index.has(trigram)) {
          this.index.set(trigram, new Set());
        }
        this.index.get(trigram)!.add(word);
      }
    }
  }

  private buildTrigram(word: string): Trigram {
    const trigrams = this.getTrigrams(word);
    const hash = this.hashTrigrams(trigrams);
    return { trigrams, length: word.length, hash };
  }

  private getTrigrams(word: string): Set<string> {
    const key = word;
    if (this.trigramPool.has(key)) {
      return this.trigramPool.get(key)!;
    }

    const trigrams = new Set<string>();

    // Add padding for better boundary matching
    const paddedWord = `  ${word}  `;

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
    // word: string,
    wordData: { trigrams: Set<string>; length: number },
  ): number {
    const { trigrams, length } = wordData;

    // Jaccard similarity with position weighting
    let matches = 0;
    let positionBonus = 0;

    const inputArray = Array.from(inputTrigrams);
    const wordArray = Array.from(trigrams);

    for (let i = 0; i < inputArray.length; i++) {
      if (trigrams.has(inputArray[i])) {
        matches++;
        // Bonus for trigrams in similar positions
        const wordPos = wordArray.indexOf(inputArray[i]);
        if (wordPos !== -1) {
          positionBonus +=
            1 -
            Math.abs(i - wordPos) /
              Math.max(inputArray.length, wordArray.length);
        }
      }
    }

    const jaccard = matches / (inputTrigrams.size + trigrams.size - matches);
    const lengthSimilarity =
      1 - Math.abs(length - input.length) / Math.max(length, input.length);
    const positionWeight = positionBonus / matches || 0;

    return jaccard * 0.7 + lengthSimilarity * 0.2 + positionWeight * 0.1;
  }

  calculateSimilarity(query: string, word: string): number {
    const queryTrigrams = this.getTrigrams(query);
    const wordData = this.wordTrigrams.get(word.toLowerCase());

    if (!wordData) return 0;

    return this.calculateAdvancedScore(query, queryTrigrams, wordData);
  }
}
