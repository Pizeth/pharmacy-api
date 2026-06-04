export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  wordCount: number = 0; // Track frequency for ranking
  frequency: number = 0; // Store frequency of the word
  /**
   * Once we collect all words under this node,
   * store them here to reuse on future calls.
   */
  cachedWords?: string[]; // Cache for popular prefixes

  // Memory optimization: reuse node instances
  static nodePool: TrieNode[] = [];

  static create(): TrieNode {
    const node = this.nodePool.pop() || new TrieNode();
    node.reset();
    return node;
  }

  static release(node: TrieNode): void {
    if (this.nodePool.length < 1000) {
      // Limit pool size
      this.nodePool.push(node);
    }
  }

  private reset(): void {
    this.children.clear();
    this.isEndOfWord = false;
    this.wordCount = 0;
    this.frequency = 0;
    this.cachedWords = undefined;
  }
}

// export class BKNode {
//   word: string;
//   children: Map<number, BKNode> = new Map();

//   constructor(word: string) {
//     this.word = word;
//   }
// }

export class BKNode {
  private childrenMap = new Map<number, BKNode>();
  readonly children: [number, BKNode][] = [];

  constructor(public readonly word: string) {}

  addChild(distance: number, node: BKNode): void {
    this.childrenMap.set(distance, node);
    this.children.push([distance, node]);
    // Keep sorted for search efficiency
    this.children.sort((a, b) => a[0] - b[0]);
  }

  getChild(distance: number): BKNode | undefined {
    return this.childrenMap.get(distance);
  }
}
