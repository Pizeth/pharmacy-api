// Enhanced Duration Parser - Improved version combining best practices

// Time multipliers (in milliseconds)
const TIME_MULTIPLIERS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30.44 * 24 * 60 * 60 * 1000, // Average month
  y: 365.25 * 24 * 60 * 60 * 1000, // Average year with leap years
} as const;

// Base unit type
export type UnitTime = keyof typeof TIME_MULTIPLIERS;

// Comprehensive alias mapping with case-insensitive support
const UNIT_ALIASES: Record<string, UnitTime> = {
  // Milliseconds
  ms: 'ms',
  millisecond: 'ms',
  milliseconds: 'ms',
  msec: 'ms',
  msecs: 'ms',

  // Seconds
  s: 's',
  sec: 's',
  secs: 's',
  second: 's',
  seconds: 's',

  // Minutes
  min: 'm',
  mins: 'm',
  minute: 'm',
  minutes: 'm',

  // Hours
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',

  // Days
  d: 'd',
  day: 'd',
  days: 'd',

  // Weeks
  w: 'w',
  wk: 'w',
  wks: 'w',
  week: 'w',
  weeks: 'w',

  // Months
  mo: 'mo',
  month: 'mo',
  months: 'mo',

  // Years
  y: 'y',
  yr: 'y',
  yrs: 'y',
  year: 'y',
  years: 'y',
};

// Ambiguous units that should be explicitly handled
const AMBIGUOUS_UNITS = new Set(['m']);

// Error types for better error handling
export class DurationParseError extends Error {
  constructor(
    message: string,
    public readonly input: string,
    public readonly code: string,
    public readonly suggestions?: string[],
  ) {
    super(message);
    this.name = 'DurationParseError';
  }
}

// Options interface
export interface ParseOptions {
  /**
   * How to handle ambiguous units like 'm' (minutes vs months)
   * - 'strict': Throw error for ambiguous units
   * - 'minutes': Interpret 'm' as minutes
   * - 'months': Interpret 'm' as months
   */
  ambiguousUnit?: 'strict' | 'minutes' | 'months';

  /**
   * Maximum input length to prevent DoS attacks
   */
  maxLength?: number;

  /**
   * Whether to allow negative values
   */
  allowNegative?: boolean;
}

export interface FormatOptions {
  /**
   * Use long format (e.g., "1 hour" vs "1h")
   */
  long?: boolean;

  /**
   * Number of decimal places for formatting
   */
  precision?: number;
}

export interface ParseResult {
  duration: number;
  unit: UnitTime;
  milliseconds: number;
}

export class EnhancedDurationParser {
  private readonly defaultOptions: Required<ParseOptions> = {
    ambiguousUnit: 'strict',
    maxLength: 100,
    allowNegative: false,
  };

  /**
   * Parse a duration string or number into milliseconds
   */
  parse(input: string | number, options?: ParseOptions): number {
    const opts = { ...this.defaultOptions, ...options };

    if (typeof input === 'number') {
      if (!opts.allowNegative && input < 0) {
        throw new DurationParseError(
          'Negative values are not allowed',
          input.toString(),
          'NEGATIVE_NOT_ALLOWED',
        );
      }
      return input;
    }

    // Validate input
    if (typeof input !== 'string') {
      throw new DurationParseError(
        'Input must be a string or number',
        String(input),
        'INVALID_TYPE',
      );
    }

    if (input.length === 0) {
      throw new DurationParseError(
        'Input cannot be empty',
        input,
        'EMPTY_INPUT',
      );
    }

    if (input.length > opts.maxLength) {
      throw new DurationParseError(
        `Input exceeds maximum length of ${opts.maxLength}`,
        input,
        'INPUT_TOO_LONG',
      );
    }

    const trimmed = input.trim();

    // Handle pure numbers (treat as milliseconds)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      if (!opts.allowNegative && num < 0) {
        throw new DurationParseError(
          'Negative values are not allowed',
          input,
          'NEGATIVE_NOT_ALLOWED',
        );
      }
      return num;
    }

    // Enhanced regex to handle various formats
    const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);

    if (!match) {
      throw new DurationParseError(
        'Invalid duration format',
        input,
        'INVALID_FORMAT',
        ['Examples: "1h", "30m", "1.5d", "2 hours"'],
      );
    }

    const [, numStr, unitStr] = match;
    const num = parseFloat(numStr);

    if (!isFinite(num)) {
      throw new DurationParseError('Invalid number', input, 'INVALID_NUMBER');
    }

    if (!opts.allowNegative && num < 0) {
      throw new DurationParseError(
        'Negative values are not allowed',
        input,
        'NEGATIVE_NOT_ALLOWED',
      );
    }

    const unit = this.normalizeUnit(unitStr.toLowerCase(), opts.ambiguousUnit);
    const multiplier = TIME_MULTIPLIERS[unit];

    return num * multiplier;
  }

  /**
   * Parse with detailed result information
   */
  parseDetailed(input: string | number, options?: ParseOptions): ParseResult {
    const opts = { ...this.defaultOptions, ...options };

    if (typeof input === 'number') {
      return {
        duration: input,
        unit: 'ms',
        milliseconds: input,
      };
    }

    const trimmed = input.trim();

    // Handle pure numbers
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      return {
        duration: num,
        unit: 'ms',
        milliseconds: num,
      };
    }

    const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
    if (!match) {
      throw new DurationParseError(
        'Invalid duration format',
        input,
        'INVALID_FORMAT',
      );
    }

    const [, numStr, unitStr] = match;
    const duration = parseFloat(numStr);
    const unit = this.normalizeUnit(unitStr.toLowerCase(), opts.ambiguousUnit);
    const milliseconds = duration * TIME_MULTIPLIERS[unit];

    return { duration, unit, milliseconds };
  }

  /**
   * Format milliseconds back to human-readable string
   */
  format(ms: number, options?: FormatOptions): string {
    const opts = { long: false, precision: 0, ...options };

    if (typeof ms !== 'number' || !isFinite(ms)) {
      throw new Error('Value must be a finite number');
    }

    const absMs = Math.abs(ms);
    const sign = ms < 0 ? '-' : '';

    // Find the most appropriate unit
    const units: Array<[UnitTime, string, string]> = [
      ['y', 'y', 'year'],
      ['mo', 'mo', 'month'],
      ['w', 'w', 'week'],
      ['d', 'd', 'day'],
      ['h', 'h', 'hour'],
      ['m', 'm', 'minute'],
      ['s', 's', 'second'],
      ['ms', 'ms', 'millisecond'],
    ];

    for (const [unit, shortSuffix, longSuffix] of units) {
      const multiplier = TIME_MULTIPLIERS[unit];
      if (absMs >= multiplier) {
        const value = ms / multiplier;
        const rounded =
          opts.precision > 0
            ? parseFloat(value.toFixed(opts.precision))
            : Math.round(value);

        if (opts.long) {
          const isPlural = Math.abs(rounded) !== 1;
          return `${rounded} ${longSuffix}${isPlural ? 's' : ''}`;
        } else {
          return `${sign}${Math.abs(rounded)}${shortSuffix}`;
        }
      }
    }

    return opts.long ? `${ms} milliseconds` : `${ms}ms`;
  }

  /**
   * Get expiration date by adding parsed duration to current time
   */
  getExpiresAt(input: string | number, options?: ParseOptions): Date {
    const milliseconds = this.parse(input, options);
    return new Date(Date.now() + milliseconds);
  }

  /**
   * Check if a string is a valid duration format
   */
  isValid(input: string | number, options?: ParseOptions): boolean {
    try {
      this.parse(input, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all supported unit aliases
   */
  getSupportedUnits(): string[] {
    return Object.keys(UNIT_ALIASES).sort();
  }

  /**
   * Normalize unit aliases to canonical units
   */
  private normalizeUnit(
    alias: string,
    ambiguousHandling: 'strict' | 'minutes' | 'months',
  ): UnitTime {
    // Handle ambiguous 'm' unit
    if (alias === 'm') {
      if (ambiguousHandling === 'strict') {
        throw new DurationParseError(
          'Ambiguous unit "m" - use "min" for minutes or "mo" for months',
          alias,
          'AMBIGUOUS_UNIT',
          ['Use "min" for minutes', 'Use "mo" for months'],
        );
      }
      return ambiguousHandling === 'minutes' ? 'm' : 'mo';
    }

    const unit = UNIT_ALIASES[alias];
    if (!unit) {
      const suggestions = this.getSuggestionsForUnit(alias);
      throw new DurationParseError(
        `Unknown unit "${alias}"`,
        alias,
        'UNKNOWN_UNIT',
        suggestions,
      );
    }

    return unit;
  }

  /**
   * Get suggestions for similar units (basic fuzzy matching)
   */
  private getSuggestionsForUnit(input: string): string[] {
    const aliases = Object.keys(UNIT_ALIASES);
    const suggestions: string[] = [];

    // Find exact prefix matches
    for (const alias of aliases) {
      if (alias.startsWith(input.toLowerCase())) {
        suggestions.push(alias);
      }
    }

    // If no prefix matches, find similar length matches
    if (suggestions.length === 0) {
      for (const alias of aliases) {
        if (Math.abs(alias.length - input.length) <= 2) {
          suggestions.push(alias);
        }
      }
    }

    return suggestions.slice(0, 5); // Limit suggestions
  }
}

// Export a default instance for convenience
export const durationParser = new EnhancedDurationParser();

// Convenience functions that match the ms library API
export function ms(
  value: string | number,
  options?: ParseOptions & FormatOptions,
): number | string {
  if (typeof value === 'string') {
    return durationParser.parse(value, options);
  } else {
    return durationParser.format(value, options);
  }
}

export const parse = (input: string | number, options?: ParseOptions) =>
  durationParser.parse(input, options);

export const format = (ms: number, options?: FormatOptions) =>
  durationParser.format(ms, options);

export const parseDetailed = (input: string | number, options?: ParseOptions) =>
  durationParser.parseDetailed(input, options);

export const isValid = (input: string | number, options?: ParseOptions) =>
  durationParser.isValid(input, options);

// Example usage and tests
if (typeof globalThis !== 'undefined' && globalThis.console) {
  console.log('=== Enhanced Duration Parser Examples ===');

  try {
    // Basic parsing
    console.log('parse("1h"):', parse('1h')); // 3600000
    console.log('parse("30m"):', parse('30m')); // 1800000
    console.log('parse("1.5d"):', parse('1.5d')); // 129600000
    console.log('parse("2 hours"):', parse('2 hours')); // 7200000

    // Formatting
    console.log('format(3600000):', format(3600000)); // "1h"
    console.log(
      'format(3600000, {long: true}):',
      format(3600000, { long: true }),
    ); // "1 hour"

    // Detailed parsing
    console.log('parseDetailed("1h"):', parseDetailed('1h'));

    // Ambiguous unit handling
    console.log(
      'parse("5m", {ambiguousUnit: "minutes"}):',
      parse('5m', { ambiguousUnit: 'minutes' }),
    );

    // Validation
    console.log('isValid("1h"):', isValid('1h')); // true
    console.log('isValid("invalid"):', isValid('invalid')); // false

    // Get expiration date
    const expiresAt = durationParser.getExpiresAt('1h');
    console.log('Expires at:', expiresAt.toISOString());
  } catch (error) {
    if (error instanceof DurationParseError) {
      console.error('Parse Error:', error.message);
      console.error('Code:', error.code);
      console.error('Suggestions:', error.suggestions);
    } else {
      console.error('Error:', error);
    }
  }
}
