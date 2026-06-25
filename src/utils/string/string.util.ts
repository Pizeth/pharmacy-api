export class StringUtils {
  /**
   * Capitalizes the first letter and adds spaces before capital letters
   * @param str - Input string to transform
   * @returns Formatted string (e.g. "helloWorld" becomes "Hello World")
   */
  static capitalize(str: string): string {
    if (!str) return '';
    const firstChar = str[0].toUpperCase();
    const rest = str.slice(1).replace(/([A-Z])/g, ' $1');
    return firstChar + rest;
    // return str
    //   .replace(/([A-Z])/g, ' $1')
    //   .replace(/^./, (char) => char.toUpperCase());
  }

  /**
   * Extracts the last segment from a URL path
   * @param path - URL path string
   * @returns Last segment of the path (e.g. "api/user/profile" returns "profile")
   */
  static getLastSegment(path: string): string {
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex === -1 ? path : path.slice(lastSlashIndex + 1);
    // return path.split('/').pop() || '';
  }

  /**
   * Truncates a string to a specified maximum length, adding an ellipsis (...) if truncated.
   * @param text - The input string to be truncated
   * @param maxLength - The maximum length of the resulting string before truncation
   * @returns The truncated string with ellipsis if longer than maxLength, or the original string if shorter
   * @example
   * ```typescript
   * StringUtils.truncate("Hello World", 5) // returns "Hello..."
   * StringUtils.truncate("Hi", 5) // returns "Hi"
   * ```
   */
  static truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  /**
   * Sanitizes a string by removing all non-alphanumeric characters.
   * @param input - The string to be sanitized
   * @returns The sanitized string containing only alphanumeric characters
   * @example
   * StringUtils.sanitize("Hello, World!") // Returns "HelloWorld"
   * StringUtils.sanitize("user@email.com") // Returns "useremailcom"
   */
  static sanitize(input: string): string {
    return input
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/\.{2,}/g, '')
      .replace(/^\.+/g, '');
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if a value is a string, null, or undefined.
   * @param value - The value to check.
   * @returns A type predicate indicating whether the value is a string, null, or undefined.
   * @example
   * ```typescript
   * isPlainText("hello") // true
   * isPlainText(null) // true
   * isPlainText(undefined) // true
   * isPlainText(123) // false
   * ```
   */
  static isPlainText(value: unknown): value is string | null | undefined {
    return typeof value === 'string' || value === null || value === undefined;
  }
}
