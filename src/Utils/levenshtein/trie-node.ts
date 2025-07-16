// src/utils/levenshtein/trie-node.ts
export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
}
