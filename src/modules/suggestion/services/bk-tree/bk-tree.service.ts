// src/utils/levenshtein/bk-tree.ts

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { BKNode } from '../../nodes/node.class';
import { LevenshteinService } from '../levenshtein/levenshtein.service';
import suggestionConfig from '../../configs/suggestion.config';
import { ConfigType } from '@nestjs/config';
import { ScoredWord } from '../../interfaces/suggestion.interface';

console.log('[LOAD] BKTreeService file loaded');
@Injectable()
export class BKTreeService {
  private readonly context = BKTreeService.name;
  private readonly logger = new Logger(this.context);
  private root: BKNode | null = null;
  private nodeCount = 0;

  constructor(
    @Inject(forwardRef(() => LevenshteinService))
    private readonly levenshteinService: LevenshteinService,
    @Inject(suggestionConfig.KEY)
    private readonly config: ConfigType<typeof suggestionConfig>, // Inject config
  ) {
    console.log('[BOOT] BKTreeService constructor');
  }

  // buildTree(words: string[]): void {
  //   const start = performance.now();
  //   this.logger.log(`BKTreeService.buildTree START (words=${words.length})`);
  //   this.root = null;
  //   this.nodeCount = 0;

  //   if (words.length === 0) return;

  //   // Sort by length for better tree balance
  //   const sortedWords = [...new Set(words.map((w) => w.toLowerCase()))].sort(
  //     (a, b) => a.length - b.length,
  //   );

  //   this.root = new BKNode(sortedWords[0]);
  //   this.nodeCount = 1;

  //   for (let i = 1; i < sortedWords.length; i++) {
  //     this.insert(sortedWords[i]);
  //   }
  //   this.logger.log(
  //     `BKTreeService.buildTree END (nodes=${this.nodeCount}) in ${performance.now() - start}ms`,
  //   );
  // }

  // in BKTreeService
  async buildTree(words: string[]): Promise<void> {
    const start = performance.now();
    this.logger.log(`BKTreeService.buildTree START (words=${words.length})`);
    this.root = null;
    this.nodeCount = 0;

    if (words.length === 0) {
      this.logger.log(
        `BKTreeService.buildTree END (empty) in ${Date.now() - start}ms`,
      );
      return;
    }

    // const unique = [...new Set(words.map((w) => w.toLowerCase()))];
    // unique.sort((a, b) => a.length - b.length);

    // Sort by length for better tree balance
    const unique = [...new Set(words.map((w) => w.toLowerCase()))].sort(
      (a, b) => a.length - b.length,
    );

    // Use a small batch size. Tune this (e.g., 200-2000) depending on dataset & CPU.
    const BATCH = Math.max(200, Math.floor(unique.length / 200) || 200);
    this.root = new BKNode(unique[0]);
    this.nodeCount = 1;

    for (let i = 1; i < unique.length; i++) {
      this.insert(unique[i]); // keep small synchronous insert
      // yield periodically so timers can fire and timeboxes work
      if (i % BATCH === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    this.logger.log(
      `BKTreeService.buildTree END (nodes=${this.nodeCount}) in ${performance.now() - start}ms`,
    );
  }

  // // Extracted small synchronous insertion helper (unchanged algorithm)
  // private insertSync(word: string): void {
  //   if (!this.root) {
  //     this.root = new BKNode(word);
  //     this.nodeCount = 1;
  //     return;
  //   }

  //   let current: BKNode = this.root;

  //   while (true) {
  //     const distance = this.levenshteinService.calculateDistance(
  //       word,
  //       current.word,
  //       this.config.maxLevenshteinDistance + 1,
  //     );

  //     if (distance === 0) return;

  //     if (!current.getChild(distance)) {
  //       current.addChild(distance, new BKNode(word));
  //       this.nodeCount++;
  //       return;
  //     }

  //     current = current.getChild(distance)!;
  //   }
  // }

  private insert(word: string): void {
    if (!this.root) {
      this.root = new BKNode(word);
      this.nodeCount = 1;
      return;
    }

    let current: BKNode = this.root;

    while (true) {
      // Pass maxLevenshteinDistance as threshold for early exit
      const distance = this.levenshteinService.calculateDistance(
        word,
        current.word,
        // Pass slightly more than max allowed to avoid aborting valid paths too early
        this.config.maxLevenshteinDistance + 1,
      );

      if (distance === 0) return;

      if (!current.getChild(distance)) {
        current.addChild(distance, new BKNode(word));
        this.nodeCount++;
        return;
      }

      current = current.getChild(distance)!;
    }
  }

  search(query: string, maxDistance: number, maxResults = 100): ScoredWord[] {
    if (!this.root) return [];

    // const results: Array<{ word: string; distance: number }> = [];
    const results: ScoredWord[] = [];
    const stack: BKNode[] = [this.root];
    const queryLower = query.toLowerCase();

    // If exact match with root, return early
    if (queryLower === this.root.word) return [{ word: query, distance: 0 }];

    while (stack.length > 0 && results.length < maxResults) {
      const node = stack.pop()!;
      const distance = this.levenshteinService.calculateDistance(
        queryLower,
        node.word,
      );

      if (distance <= maxDistance) {
        results.push({ word: node.word, distance });
      }

      // Triangle inequality optimization
      const minDist = Math.max(1, distance - maxDistance);
      const maxDist = distance + maxDistance;

      for (const [childDistance, childNode] of node.children) {
        if (childDistance >= minDist && childDistance <= maxDist) {
          stack.push(childNode);
        }
      }
    }

    // The final sort is now free, as the distance is already known
    return results.sort((a, b) => a.distance - b.distance);
  }

  getStats(): { nodeCount: number } {
    return { nodeCount: this.nodeCount };
  }
}

// @Injectable()
// export class BKTreeService {
//   private root: BKNode | null = null;

//   constructor(private readonly levenshteinService: LevenshteinService) {}

//   buildTree(words: string[]): void {
//     this.root = null;
//     if (words.length === 0) return;

//     this.root = new BKNode(words[0].toLowerCase());

//     for (let i = 1; i < words.length; i++) {
//       this.insert(words[i].toLowerCase());
//     }
//   }

//   private insert(word: string): void {
//     if (!this.root) {
//       this.root = new BKNode(word);
//       return;
//     }

//     let current: BKNode = this.root;

//     while (true) {
//       const distance = this.levenshteinService.calculateDistance(
//         word,
//         current.word,
//       );

//       if (distance === 0) return; // Word already exists

//       if (!current.children.has(distance)) {
//         current.children.set(distance, new BKNode(word));
//         return;
//       }

//       current = current.children.get(distance)!;
//     }
//   }

//   search(query: string, maxDistance: number): string[] {
//     const results: string[] = [];
//     if (!this.root) return results;

//     const stack: BKNode[] = [this.root];
//     const queryLower = query.toLowerCase();

//     if (queryLower === this.root.word) return [query];

//     while (stack.length > 0) {
//       const node = stack.pop()!;
//       const distance = this.levenshteinService.calculateDistance(
//         queryLower,
//         node.word,
//       );

//       if (distance <= maxDistance) {
//         results.push(node.word);
//       }

//       // Calculate child distance range using triangle inequality
//       const minDist = Math.max(1, distance - maxDistance);
//       const maxDist = distance + maxDistance;

//       for (const [childDistance, childNode] of node.children.entries()) {
//         if (childDistance >= minDist && childDistance <= maxDist) {
//           stack.push(childNode);
//         }
//       }
//     }

//     // Sort by distance to query
//     return results.sort((a, b) => {
//       const distA = this.levenshteinService.calculateDistance(query, a);
//       const distB = this.levenshteinService.calculateDistance(query, b);
//       return distA - distB;
//     });
//   }
// }

// searchOld(query: string, maxDistance: number): string[] {
//   const results: string[] = [];
//   if (!this.root) return results;

//   this.searchRecursive(this.root, query.toLowerCase(), maxDistance, results);

//   return results.sort((a, b) => {
//     const distA = this.levenshteinService.calculateDistance(query, a);
//     const distB = this.levenshteinService.calculateDistance(query, b);
//     return distA - distB;
//   });
// }

// private searchRecursive(
//   node: BKNode,
//   query: string,
//   maxDistance: number,
//   results: string[],
// ): void {
//   const distance = this.levenshteinService.calculateDistance(
//     query,
//     node.word,
//   );

//   if (distance <= maxDistance) {
//     results.push(node.word);
//   }

//   // Use triangle inequality to prune search space
//   // Only explore children where |d(query, child) - d(query, current)| <= maxDistance
//   const minChild = Math.max(1, distance - maxDistance);
//   const maxChild = distance + maxDistance;

//   for (const [childDistance, childNode] of node.children) {
//     if (childDistance >= minChild && childDistance <= maxChild) {
//       this.searchRecursive(childNode, query, maxDistance, results);
//     }
//   }
// }
