// src/utils/levenshtein/trie.engine.ts
import { TrieNode } from './trie-node';

export class TrieEngine {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
  }

  /**
   * Get all words in the trie that start with the given prefix
   */
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
