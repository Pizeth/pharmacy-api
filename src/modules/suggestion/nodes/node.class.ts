export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  wordCount = 0; // Track frequency for ranking
  /**
   * Once we collect all words under this node,
   * store them here to reuse on future calls.
   */
  cachedWords?: string[]; // Cache for popular prefixes
}

export class BKNode {
  word: string;
  children: Map<number, BKNode> = new Map();

  constructor(word: string) {
    this.word = word;
  }
}
