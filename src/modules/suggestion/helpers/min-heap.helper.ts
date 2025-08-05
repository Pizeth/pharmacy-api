// MinHeap implementation
// export class MinHeap<T> {
//   private data: T[] = [];
//   constructor(private compare: (a: T, b: T) => number) {}

//   push(item: T): void {
//     this.data.push(item);
//     this.bubbleUp(this.data.length - 1);
//   }

//   pop(): T | undefined {
//     if (this.data.length === 0) return undefined;
//     const top = this.data[0];
//     const bottom = this.data.pop()!;
//     if (this.data.length > 0) {
//       this.data[0] = bottom;
//       this.sinkDown(0);
//     }
//     return top;
//   }

//   peek(): T | undefined {
//     return this.data[0];
//   }

//   size(): number {
//     return this.data.length;
//   }

//   toSortedArray(): T[] {
//     return [...this.data].sort(this.compare);
//   }

//   private bubbleUp(index: number): void {
//     while (index > 0) {
//       const parentIndex = Math.floor((index - 1) / 2);
//       if (this.compare(this.data[index], this.data[parentIndex]) >= 0) break;
//       [this.data[index], this.data[parentIndex]] = [
//         this.data[parentIndex],
//         this.data[index],
//       ];
//       index = parentIndex;
//     }
//   }

//   private sinkDown(index: number): void {
//     const length = this.data.length;
//     while (true) {
//       const leftIndex = 2 * index + 1;
//       const rightIndex = 2 * index + 2;
//       let swapIndex = null;

//       if (
//         leftIndex < length &&
//         this.compare(this.data[leftIndex], this.data[index]) < 0
//       ) {
//         swapIndex = leftIndex;
//       }

//       if (
//         rightIndex < length &&
//         this.compare(
//           this.data[rightIndex],
//           swapIndex === null ? this.data[index] : this.data[leftIndex],
//         ) < 0
//       ) {
//         swapIndex = rightIndex;
//       }

//       if (swapIndex === null) break;
//       [this.data[index], this.data[swapIndex]] = [
//         this.data[swapIndex],
//         this.data[index],
//       ];
//       index = swapIndex;
//     }
//   }
// }

// export class MinHeap<T> {
//   private data: T[] = [];
//   private _size = 0;

//   constructor(private compare: (a: T, b: T) => number) {}

//   push(item: T): void {
//     this.data[this._size] = item;
//     this.bubbleUp(this._size);
//     this._size++;
//   }

//   pop(): T | undefined {
//     if (this._size === 0) return undefined;
//     const top = this.data[0];
//     this._size--;
//     if (this._size > 0) {
//       this.data[0] = this.data[this._size];
//       this.sinkDown(0);
//     }
//     return top;
//   }

//   peek(): T | undefined {
//     return this._size > 0 ? this.data[0] : undefined;
//   }

//   size(): number {
//     return this._size;
//   }

//   clear(): void {
//     this._size = 0;
//   }

//   toSortedArray(): T[] {
//     return this.data.slice(0, this._size).sort(this.compare);
//   }

//   private bubbleUp(index: number): void {
//     while (index > 0) {
//       const parentIndex = (index - 1) >>> 1; // Faster integer division
//       if (this.compare(this.data[index], this.data[parentIndex]) >= 0) break;
//       [this.data[index], this.data[parentIndex]] = [
//         this.data[parentIndex],
//         this.data[index],
//       ];
//       index = parentIndex;
//     }
//   }

//   private sinkDown(index: number): void {
//     while (true) {
//       const leftIndex = (index << 1) + 1; // Faster multiplication
//       const rightIndex = leftIndex + 1;
//       let swapIndex = -1;

//       if (
//         leftIndex < this._size &&
//         this.compare(this.data[leftIndex], this.data[index]) < 0
//       ) {
//         swapIndex = leftIndex;
//       }

//       if (
//         rightIndex < this._size &&
//         this.compare(
//           this.data[rightIndex],
//           swapIndex === -1 ? this.data[index] : this.data[leftIndex],
//         ) < 0
//       ) {
//         swapIndex = rightIndex;
//       }

//       if (swapIndex === -1) break;
//       [this.data[index], this.data[swapIndex]] = [
//         this.data[swapIndex],
//         this.data[index],
//       ];
//       index = swapIndex;
//     }
//   }
// }

export class MinHeap<T> {
  private data: T[] = [];
  private _size = 0;

  constructor(private compare: (a: T, b: T) => number) {}

  size(): number {
    return this._size;
  }

  // Bulk insert with heapify (O(n) vs O(n log n))
  pushAll(items: T[]): void {
    if (items.length === 0) return;

    // Append all items
    for (const item of items) {
      this.data[this._size++] = item;
    }

    // Heapify from bottom up (more efficient for bulk)
    for (let i = Math.floor((this._size - 2) / 2); i >= 0; i--) {
      this.sinkDown(i);
    }
  }

  push(item: T): void {
    this.data[this._size] = item;
    this.bubbleUp(this._size++);
  }

  pop(): T | undefined {
    if (this._size === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data[--this._size];
    if (this._size > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this._size > 0 ? this.data[0] : undefined;
  }

  clear(): void {
    this._size = 0;
    // Don't resize array, just reset size for better memory reuse
    // this.data.length = 0; // free internal buffer
  }

  toSortedArray(): T[] {
    // single pass slice + built-in sort
    return this.data.slice(0, this._size).sort(this.compare);
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >>> 1; // Faster integer division
      if (this.compare(this.data[idx], this.data[parent]) >= 0) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const end = this._size;
    while (true) {
      const left = (idx << 1) + 1; // Faster multiplication
      const right = left + 1;
      let swap = idx;

      if (left < end && this.compare(this.data[left], this.data[swap]) < 0) {
        swap = left;
      }
      if (right < end && this.compare(this.data[right], this.data[swap]) < 0) {
        swap = right;
      }
      if (swap === idx) break;

      [this.data[idx], this.data[swap]] = [this.data[swap], this.data[idx]];
      idx = swap;
    }
  }
}
