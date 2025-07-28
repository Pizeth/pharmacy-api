// src/utils/levenshtein/bk-tree.ts

import { Injectable } from '@nestjs/common';
import { BKNode } from '../../nodes/node.class';
import { LevenshteinService } from '../levenshtein/levenshtein.service';

@Injectable()
export class BKTreeService {
  private root: BKNode | null = null;

  constructor(private readonly levenshteinService: LevenshteinService) {}

  buildTree(words: string[]): void {
    this.root = null;
    if (words.length === 0) return;

    this.root = new BKNode(words[0].toLowerCase());

    for (let i = 1; i < words.length; i++) {
      this.insert(words[i].toLowerCase());
    }
  }

  private insert(word: string): void {
    if (!this.root) {
      this.root = new BKNode(word);
      return;
    }

    let current: BKNode = this.root;

    while (true) {
      const distance = this.levenshteinService.calculateDistance(
        word,
        current.word,
      );

      if (distance === 0) return; // Word already exists

      if (!current.children.has(distance)) {
        current.children.set(distance, new BKNode(word));
        return;
      }

      current = current.children.get(distance)!;
    }
  }

  search(query: string, maxDistance: number): string[] {
    const results: string[] = [];
    if (!this.root) return results;

    const stack: BKNode[] = [this.root];
    const queryLower = query.toLowerCase();

    if (queryLower === this.root.word) return [query];

    while (stack.length > 0) {
      const node = stack.pop()!;
      const distance = this.levenshteinService.calculateDistance(
        queryLower,
        node.word,
      );

      if (distance <= maxDistance) {
        results.push(node.word);
      }

      // Calculate child distance range using triangle inequality
      const minDist = Math.max(1, distance - maxDistance);
      const maxDist = distance + maxDistance;

      for (const [childDistance, childNode] of node.children.entries()) {
        if (childDistance >= minDist && childDistance <= maxDist) {
          stack.push(childNode);
        }
      }
    }

    // Sort by distance to query
    return results.sort((a, b) => {
      const distA = this.levenshteinService.calculateDistance(query, a);
      const distB = this.levenshteinService.calculateDistance(query, b);
      return distA - distB;
    });
  }

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
}
