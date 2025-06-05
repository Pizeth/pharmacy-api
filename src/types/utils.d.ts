export interface ArrayLike {
  length: number;
}

export interface IsEmptyOptions {
  /**
   * A custom function to determine if an object is empty.
   * IMPORTANT: This function is called FIRST for any object type,
   * allowing override of all subsequent standard checks.
   * @param value - The object value to check.
   * @returns `true` if the custom logic considers the value empty, `false` otherwise.
   */
  customIsEmpty?: (value: object) => boolean;
  /** Treat the number 0 as empty. Defaults to false. */
  zeroAsEmpty?: boolean;
  /** Treat the boolean false as empty. Defaults to false. */
  falseAsEmpty?: boolean;
  /** Treat Date, RegExp, Error instances as empty. Defaults to false. */
  specialObjectsAsEmpty?: boolean;
  /** Internal flag for recursion protection (e.g., with WeakRef). */
  _internalCall?: boolean;
  /** Halt on Custom Error flag for rethrows customIsEmpty errors. */
  haltOnCustomError?: boolean;
  /** Override with `unwrapProxy` option if you need to inspect the target. */
  unwrapProxy?: UnwrapProxy;
}

export interface WithIsEmpty {
  isEmpty(): boolean;
}

export type UnwrapProxy = (proxy: object) => unknown;

export const unwrapProxySymbol: unique symbol = Symbol('unwrapProxy');
