import { Injectable } from '@nestjs/common';
import { TrieNode } from '../../nodes/node.class';

// @Injectable()
// export class TrieService {
//   private root = new TrieNode();

//   buildTrie(words: string[]): void {
//     this.root = new TrieNode();

//     for (const word of words) {
//       this.insert(word.toLowerCase());
//     }
//   }

//   private insert(word: string): void {
//     let node = this.root;
//     for (const char of word) {
//       if (!node.children.has(char)) {
//         node.children.set(char, new TrieNode());
//       }
//       node = node.children.get(char)!;
//     }
//     node.isEndOfWord = true;
//   }

//   // getWordsWithPrefixOld(prefix: string): string[] {
//   //   const results: string[] = [];
//   //   const prefixLower = prefix.toLowerCase();
//   //   let node = this.root;

//   //   for (const char of prefixLower) {
//   //     if (!node.children.has(char)) return [];
//   //     node = node.children.get(char)!;
//   //   }

//   //   this.collectWords(node, prefixLower, results);
//   //   return results;
//   // }

//   // private collectWords(
//   //   node: TrieNode,
//   //   current: string,
//   //   results: string[],
//   // ): void {
//   //   if (node.isEndOfWord) results.push(current);
//   //   for (const [char, child] of node.children.entries()) {
//   //     this.collectWords(child, current + char, results);
//   //   }
//   // }

//   *streamWordsWithPrefix(
//     prefix: string,
//     maxWords = Infinity,
//   ): Generator<string> {
//     const prefixLower = prefix.toLowerCase();
//     let node = this.root;
//     let count = 0;

//     // Traverse to prefix node
//     for (const char of prefixLower) {
//       if (!node.children.has(char)) return;
//       node = node.children.get(char)!;
//     }

//     // DFS generator
//     const stack: [TrieNode, string][] = [[node, prefixLower]];
//     while (stack.length > 0 && count < maxWords) {
//       const [current, word] = stack.pop()!;

//       if (current.isEndOfWord) {
//         yield word;
//         count++;
//       }

//       for (const [char, child] of current.children.entries()) {
//         stack.push([child, word + char]);
//       }
//     }
//   }

//   getWordsWithPrefix(prefix: string, maxWords = Infinity): string[] {
//     return Array.from(this.streamWordsWithPrefix(prefix, maxWords));
//   }
// }

// getWordsWithPrefix(prefix: string, maxWords = Infinity): string[] {
//   const prefixLower = prefix.toLowerCase();
//   let node = this.root;

//   // 1. Traverse to the prefix node
//   for (const char of prefixLower) {
//     if (!node.children.has(char)) return [];
//     node = node.children.get(char)!;
//   }

//   // 2. If cached, return a quick slice
//   if (node.cachedWords) {
//     return node.cachedWords.slice(0, maxWords);
//   }

//   // 3. First‐time: collect all descendants
//   const results: string[] = [];
//   this.collectWords(node, prefixLower, results);

//   // 4. Cache & return top‐K
//   node.cachedWords = results;
//   return results.slice(0, maxWords);
// }

// private collectWords(node: TrieNode, prefix: string, out: string[]): void {
//   if (node.isEndOfWord) out.push(prefix);
//   for (const [ch, child] of node.children) {
//     this.collectWords(child, prefix + ch, out);
//   }
// }
@Injectable()
export class TrieService {
  private root = new TrieNode();
  private readonly maxCacheDepth = 3; // Cache only short prefixes

  buildTrie(words: string[]): void {
    this.root = new TrieNode();

    // Build trie with frequency tracking
    const wordFreq = new Map<string, number>();
    words.forEach((word) => {
      const lower = word.toLowerCase();
      wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
    });

    for (const [word, freq] of wordFreq) {
      this.insert(word, freq);
    }

    // Pre-cache popular prefixes
    this.precachePopularPrefixes();
  }

  private insert(word: string, frequency: number): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
      node.wordCount++;
    }
    node.isEndOfWord = true;
    node.frequency = frequency; // Store the word's frequency
  }

  private precachePopularPrefixes(): void {
    const queue: [TrieNode, string, number][] = [[this.root, '', 0]];

    while (queue.length > 0) {
      const [node, prefix, depth] = queue.shift()!;

      // Cache prefixes with high word count OR high frequency words
      if (
        depth > 0 &&
        depth <= this.maxCacheDepth &&
        (node.wordCount > 10 || (node.isEndOfWord && node.frequency > 5))
      ) {
        // Now efficiently collects words starting from this node
        node.cachedWords = this.collectWordsSync(node, prefix, 50);
      }

      if (depth < this.maxCacheDepth) {
        for (const [char, child] of node.children) {
          queue.push([child, prefix + char, depth + 1]);
        }
      }
    }
  }

  *streamWordsWithPrefix(
    prefix: string,
    maxWords = Infinity,
  ): Generator<string> {
    const prefixLower = prefix.toLowerCase();
    let node = this.root;
    let count = 0;

    // Navigate to prefix node
    for (const char of prefixLower) {
      if (!node.children.has(char)) return;
      node = node.children.get(char)!;
    }

    // Use cached results if available
    if (node.cachedWords) {
      for (const word of node.cachedWords.slice(0, maxWords)) {
        yield word;
        if (++count >= maxWords) return;
      }
      return;
    }

    // DFS with priority queue for frequency-based ordering
    const stack: [TrieNode, string, number][] = [
      [node, prefixLower, node.frequency],
    ];

    while (stack.length > 0 && count < maxWords) {
      // Sort by frequency (higher frequency first)
      stack.sort((a, b) => b[2] - a[2]);

      const [current, word] = stack.pop()!;
      if (current.isEndOfWord) {
        yield word;
        count++;
      }

      // Process children in reverse alphabetical order
      const sortedChildren = [...current.children.entries()].sort((a, b) =>
        b[0].localeCompare(a[0]),
      );

      for (const [char, child] of sortedChildren /*current.children*/) {
        stack.push([child, word + char, child.frequency]);
      }
    }
  }

  private collectWordsSync(
    node: TrieNode,
    prefix: string,
    maxWords: number,
  ): string[] {
    const results: string[] = [];
    let count = 0;

    // Use cached results if available
    if (node.cachedWords) {
      return node.cachedWords.slice(0, maxWords);
    }

    // DFS collection directly from the provided node
    const stack: [TrieNode, string, number][] = [
      [node, prefix, node.frequency || 0],
    ];

    while (stack.length > 0 && count < maxWords) {
      // Sort by frequency (higher frequency first)
      stack.sort((a, b) => b[2] - a[2]);

      const [current, word] = stack.pop()!;

      if (current.isEndOfWord) {
        results.push(word);
        count++;
      }

      for (const [char, child] of current.children) {
        stack.push([child, word + char, child.frequency || 0]);
      }
    }

    return results;
  }

  getWordsWithPrefix(prefix: string, maxWords = Infinity): string[] {
    // return Array.from(this.streamWordsWithPrefix(prefix, maxWords));
    const results: string[] = [];
    for (const word of this.streamWordsWithPrefix(prefix, maxWords)) {
      results.push(word);
    }
    return results;
  }
}

// export class TrigramIndex {
//   private index = new Map<string, Set<string>>();
//   private aliasStats = new Map<
//     string,
//     { trigrams: Set<string>; length: number }
//   >();

//   constructor(private aliases: string[]) {
//     this.buildIndex();
//   }

//   private buildIndex(): void {
//     for (const alias of this.aliases) {
//       const trigrams = this.getTrigrams(alias);
//       this.aliasStats.set(alias, { trigrams, length: alias.length });

//       for (const trigram of trigrams) {
//         if (!this.index.has(trigram)) {
//           this.index.set(trigram, new Set());
//         }
//         this.index.get(trigram)!.add(alias);
//       }
//     }
//   }

//   getTrigrams(str: string): Set<string> {
//     const trigrams = new Set<string>();
//     const normalized = str.toLowerCase();

//     for (let i = 0; i <= normalized.length - 3; i++) {
//       trigrams.add(normalized.substring(i, i + 3));
//     }
//     return trigrams;
//   }

//   getCandidates(input: string, threshold = 0.3): string[] {
//     const inputTrigrams = this.getTrigrams(input);
//     if (inputTrigrams.size === 0) return [];

//     const candidateScores = new Map<string, number>();

//     // Union only relevant trigrams
//     for (const trigram of inputTrigrams) {
//       this.index.get(trigram)?.forEach((alias) => {
//         const current = candidateScores.get(alias) || 0;
//         candidateScores.set(alias, current + 1);
//       });
//     }

//     // Calculate normalized similarity
//     return Array.from(candidateScores.entries())
//       .map(([alias, matches]) => {
//         const { trigrams, length } = this.aliasStats.get(alias)!;
//         const maxTrigrams = Math.max(trigrams.size, inputTrigrams.size);
//         const similarity = matches / maxTrigrams;

//         // Length-based penalty
//         const lengthPenalty =
//           Math.abs(length - input.length) / Math.max(length, input.length);
//         return { alias, score: similarity * (1 - lengthPenalty) };
//       })
//       .filter(({ score }) => score >= threshold)
//       .sort((a, b) => b.score - a.score)
//       .map(({ alias }) => alias);
//   }
// }
