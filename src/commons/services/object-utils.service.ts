import { Injectable } from '@nestjs/common';

/**
 * A simple Utility class for omitting properties from an object
 * while preserving full TypeScript type-safety.
 */
@Injectable()
export class ObjectOmitter<T extends object> {
  // ------------- 1. Instance API ---------------------------------

  constructor(private readonly source: T) {}

  /**
   * Return a shallow clone of `source` without the specified keys.
   */
  omit<K extends keyof T>(...keys: K[]): Omit<T, K> {
    const clone = { ...this.source } as Partial<T>;
    for (const key of keys) {
      delete clone[key];
    }
    return clone as Omit<T, K>;
  }

  // ------------- 2. Static helper --------------------------------

  /**
   * One-shot static variant that mirrors the original standalone
   * function.  Useful if you don’t need to keep `source` around.
   */
  static from<U extends object>() {
    return new ObjectOmitter<U>({} as U);
  }

  static omit<U extends object, K extends keyof U>(
    obj: U,
    ...keys: K[]
  ): Omit<U, K> {
    return new ObjectOmitter(obj).omit(...keys);
  }
}
