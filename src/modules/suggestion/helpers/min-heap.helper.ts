// MinHeap implementation
export class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  size(): number {
    return this.data.length;
  }

  toSortedArray(): T[] {
    return [...this.data].sort(this.compare);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index], this.data[parentIndex]) >= 0) break;
      [this.data[index], this.data[parentIndex]] = [
        this.data[parentIndex],
        this.data[index],
      ];
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.data.length;
    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;
      let swapIndex = null;

      if (
        leftIndex < length &&
        this.compare(this.data[leftIndex], this.data[index]) < 0
      ) {
        swapIndex = leftIndex;
      }

      if (
        rightIndex < length &&
        this.compare(
          this.data[rightIndex],
          swapIndex === null ? this.data[index] : this.data[leftIndex],
        ) < 0
      ) {
        swapIndex = rightIndex;
      }

      if (swapIndex === null) break;
      [this.data[index], this.data[swapIndex]] = [
        this.data[swapIndex],
        this.data[index],
      ];
      index = swapIndex;
    }
  }
}
