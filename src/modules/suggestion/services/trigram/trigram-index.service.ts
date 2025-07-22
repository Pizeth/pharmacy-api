import { Injectable } from '@nestjs/common';

@Injectable()
export class TrigramIndexService {
  private index: Map<string, Set<string>> = new Map();
  private wordTrigrams: Map<string, Set<string>> = new Map();

  buildIndex(words: string[]): void {
    this.index.clear();
    this.wordTrigrams.clear();

    for (const word of words) {
      const trigrams = this.getTrigrams(word.toLowerCase());
      this.wordTrigrams.set(word.toLowerCase(), trigrams);

      // Build inverted index
      for (const trigram of trigrams) {
        if (!this.index.has(trigram)) {
          this.index.set(trigram, new Set());
        }
        this.index.get(trigram)!.add(word.toLowerCase());
      }
    }
  }

  private getTrigrams(word: string): Set<string> {
    const trigrams = new Set<string>();

    // Add padding for better boundary matching
    const paddedWord = `  ${word}  `;

    for (let i = 0; i < paddedWord.length - 2; i++) {
      trigrams.add(paddedWord.slice(i, i + 3));
    }
    return trigrams;
  }

  getCandidates(query: string, minSharedTrigrams: number = 1): Set<string> {
    const queryTrigrams = this.getTrigrams(query.toLowerCase());
    const candidateCounts = new Map<string, number>();

    for (const trigram of queryTrigrams) {
      const wordsWithTrigram = this.index.get(trigram);
      if (wordsWithTrigram) {
        for (const word of wordsWithTrigram) {
          candidateCounts.set(word, (candidateCounts.get(word) || 0) + 1);
        }
      }
    }

    // Filter by minimum shared trigrams
    const candidates = new Set<string>();
    for (const [word, count] of candidateCounts) {
      if (count >= minSharedTrigrams) {
        candidates.add(word);
      }
    }

    return candidates;
  }

  calculateSimilarity(query: string, word: string): number {
    const queryTrigrams = this.getTrigrams(query.toLowerCase());
    const wordTrigrams = this.wordTrigrams.get(word.toLowerCase());

    if (!wordTrigrams) return 0;

    let intersection = 0;
    for (const trigram of queryTrigrams) {
      if (wordTrigrams.has(trigram)) intersection++;
    }

    const union = queryTrigrams.size + wordTrigrams.size - intersection;
    return union === 0 ? 0 : intersection / union; // Jaccard similarity
  }

  getTopCandidates(
    query: string,
    maxCandidates: number = 50,
    minSimilarity: number = 0.1,
  ): string[] {
    const candidates = this.getCandidates(query, 1);

    return Array.from(candidates)
      .map((word) => ({
        word,
        similarity: this.calculateSimilarity(query, word),
      }))
      .filter((item) => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxCandidates)
      .map((item) => item.word);
  }
}
