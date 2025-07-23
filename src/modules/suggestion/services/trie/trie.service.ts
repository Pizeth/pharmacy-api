import { Injectable } from '@nestjs/common';
import { TrieNode } from '../../nodes/node.class';

@Injectable()
export class TrieService {
  private root = new TrieNode();

  buildTrie(words: string[]): void {
    this.root = new TrieNode();

    for (const word of words) {
      this.insert(word.toLowerCase());
    }
  }

  private insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
  }

  getWordsWithPrefix(prefix: string): string[] {
    const results: string[] = [];
    const prefixLower = prefix.toLowerCase();
    let node = this.root;

    for (const char of prefixLower) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }

    this.collectWords(node, prefixLower, results);
    return results;
  }

  private collectWords(
    node: TrieNode,
    current: string,
    results: string[],
  ): void {
    if (node.isEndOfWord) results.push(current);
    for (const [char, child] of node.children.entries()) {
      this.collectWords(child, current + char, results);
    }
  }
}

export class TrigramIndex {
  private index = new Map<string, Set<string>>();
  private aliasStats = new Map<
    string,
    { trigrams: Set<string>; length: number }
  >();

  constructor(private aliases: string[]) {
    this.buildIndex();
  }

  private buildIndex(): void {
    for (const alias of this.aliases) {
      const trigrams = this.getTrigrams(alias);
      this.aliasStats.set(alias, { trigrams, length: alias.length });

      for (const trigram of trigrams) {
        if (!this.index.has(trigram)) {
          this.index.set(trigram, new Set());
        }
        this.index.get(trigram)!.add(alias);
      }
    }
  }

  getTrigrams(str: string): Set<string> {
    const trigrams = new Set<string>();
    const normalized = str.toLowerCase();

    for (let i = 0; i <= normalized.length - 3; i++) {
      trigrams.add(normalized.substring(i, i + 3));
    }
    return trigrams;
  }

  getCandidates(input: string, threshold = 0.3): string[] {
    const inputTrigrams = this.getTrigrams(input);
    if (inputTrigrams.size === 0) return [];

    const candidateScores = new Map<string, number>();

    // Union only relevant trigrams
    for (const trigram of inputTrigrams) {
      this.index.get(trigram)?.forEach((alias) => {
        const current = candidateScores.get(alias) || 0;
        candidateScores.set(alias, current + 1);
      });
    }

    // Calculate normalized similarity
    return Array.from(candidateScores.entries())
      .map(([alias, matches]) => {
        const { trigrams, length } = this.aliasStats.get(alias)!;
        const maxTrigrams = Math.max(trigrams.size, inputTrigrams.size);
        const similarity = matches / maxTrigrams;

        // Length-based penalty
        const lengthPenalty =
          Math.abs(length - input.length) / Math.max(length, input.length);
        return { alias, score: similarity * (1 - lengthPenalty) };
      })
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .map(({ alias }) => alias);
  }
}
