export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
}

export class BKNode {
  word: string;
  children: Map<number, BKNode> = new Map();

  constructor(word: string) {
    this.word = word;
  }
}
