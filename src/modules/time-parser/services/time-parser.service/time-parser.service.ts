// -----------------------------------------------------------------
// The Duration Parser Service
// Location: src/modules/time-parser/services/time-parser.service.ts
// -----------------------------------------------------------------
import { Injectable } from '@nestjs/common';
import { DurationParseError } from 'src/exceptions/duration-parse.exception';
import {
  TIME_MULTIPLIERS,
  UNIT_ALIASES,
  UnitTime,
  ParseOptions,
  FormatOptions,
  ParseResult,
  AMBIGUOUS_UNITS,
  DetailedParseResult,
} from 'src/types/time';

@Injectable()
export class TimeParserService {
  private readonly defaultParseOptions: Required<ParseOptions> = {
    ambiguousUnit: 'strict',
    maxLength: 100,
    allowNegative: false,
  };

  /**
   * Parse a duration string or number into milliseconds.
   * This is the main parsing method, containing your robust logic.
   */
  parse(input: string | number, options?: ParseOptions): number {
    const opts = { ...this.defaultParseOptions, ...options };

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

    if (typeof input !== 'string' || input.length === 0) {
      throw new DurationParseError(
        'Input must be a non-empty string',
        String(input),
        'INVALID_TYPE',
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
    // if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    // **ENHANCEMENT**: Added support for scientific notation.
    if (/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) {
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

    // // Handle compound durations (e.g., "1h 30m")
    // const components = trimmed.split(/\s+/);
    // let totalMs = 0;

    // for (const component of components) {
    //   const match = component.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
    //   if (!match) {
    //     throw new DurationParseError(
    //       `Invalid duration component: "${component}"`,
    //       input,
    //       'INVALID_FORMAT',
    //       [
    //         'Each component should be in the format: <number><unit> (e.g., "1h", "30m")',
    //       ],
    //     );
    //   }
    //   const [, numStr, unitStr] = match;
    //   const num = parseFloat(numStr);
    //   const unit = this.normalizeUnit(
    //     unitStr.toLowerCase(),
    //     opts.ambiguousUnit,
    //   );
    //   const multiplier = TIME_MULTIPLIERS[unit];
    //   totalMs += num * multiplier;
    // }

    // return totalMs;

    // **ENHANCEMENT**: Handle compound durations (e.g., "1h 30m", "2d 4h 30m")
    const components = trimmed.split(/\s+/).filter((c) => c.length > 0); // Filter out empty strings
    if (components.length > 1) {
      let totalMs = 0;
      const usedUnits = new Set<UnitTime>();
      // let hasNegativeComponent = false;

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        // Skip empty components
        if (!component) continue;

        // We can't recursively call `this.parse` as it would re-split.
        // We parse each component individually here.
        const match = component.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
        if (!match) {
          throw new DurationParseError(
            `Invalid duration component: "${component}"`,
            input,
            'INVALID_FORMAT',
            [
              'Each component should be in the format: <number><unit> (e.g., "1h", "30m")',
              'Examples: "1h 30m", "2d 4h 30m", "1.5h"',
            ],
          );
        }

        const [, numStr, unitStr] = match;
        const duration = parseFloat(numStr);
        if (!isFinite(duration))
          throw new DurationParseError(
            `Invalid number in component "${component}"`,
            input,
            'INVALID_NUMBER',
          );

        // Track if we have any negative values
        // hasNegativeComponent = num < 0;
        if (duration < 0) {
          if (!opts.allowNegative) {
            throw new DurationParseError(
              'Negative values are not allowed',
              input,
              'NEGATIVE_NOT_ALLOWED',
            );
          }
          // Only allow negative in the first component for compound durations
          if (i > 0) {
            throw new DurationParseError(
              'Negative values only allowed on first component',
              input,
              'INVALID_NEGATIVE_POSITION',
            );
          }
        }

        const unit = this.normalizeUnit(
          unitStr.toLowerCase(),
          opts.ambiguousUnit,
        );

        // Check for duplicate units
        if (usedUnits.has(unit)) {
          throw new DurationParseError(
            `Duplicate unit "${unitStr}" in compound duration`,
            input,
            'DUPLICATE_UNIT',
            [
              'Each unit should appear only once',
              'Example: "1h 30m" not "1h 2h"',
            ],
          );
        }
        usedUnits.add(unit);

        totalMs += duration * TIME_MULTIPLIERS[unit];
      }
      return totalMs;
    }

    // Enhanced regex to handle various formats
    const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
    if (!match) {
      throw new DurationParseError(
        'Invalid duration format',
        input,
        'INVALID_FORMAT',
        ['Examples of valid format: "1h", "30m", "1.5d", "2 hours"'],
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
    const result = num * multiplier;

    // **ENHANCEMENT**: Boundary case handling for safe integers.
    if (Math.abs(result) > Number.MAX_SAFE_INTEGER) {
      throw new DurationParseError(
        'Value exceeds safe integer limit',
        input,
        'VALUE_TOO_LARGE',
      );
    }
    return result;
  }

  /**
   * Parse with detailed result information
   */
  parseDetailed(
    input: string | number,
    options?: ParseOptions,
  ): DetailedParseResult {
    const opts = { ...this.defaultParseOptions, ...options };

    if (typeof input === 'number') {
      return {
        totalMilliseconds: input,
        components: [{ duration: input, unit: 'ms', milliseconds: input }],
      };
    }

    const trimmed = input.trim();

    // Handle pure numbers
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      return {
        totalMilliseconds: num,
        components: [{ duration: num, unit: 'ms', milliseconds: num }],
      };
    }

    // Handle compound durations - return array of components
    const components = trimmed.split(/\s+/).filter((c) => c.length > 0); // Filter out empty strings
    if (components.length > 1) {
      const results: ParseResult[] = [];
      let totalMilliseconds = 0;
      const usedUnits = new Set<UnitTime>();

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        // Skip empty components
        if (!component) continue;

        // We can't recursively call `this.parse` as it would re-split.
        // We parse each component individually here.
        const match = component.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
        if (!match) {
          throw new DurationParseError(
            `Invalid duration component: "${component}"`,
            input,
            'INVALID_FORMAT',
            [
              'Each component should be in the format: <number><unit> (e.g., "1h", "30m")',
              'Examples: "1h 30m", "2d 4h 30m", "1.5h"',
            ],
          );
        }

        const [, numStr, unitStr] = match;
        const duration = parseFloat(numStr);
        if (!isFinite(duration))
          throw new DurationParseError(
            `Invalid number in component "${component}"`,
            input,
            'INVALID_NUMBER',
          );

        // Track if we have any negative values
        // hasNegativeComponent = num < 0;
        if (duration < 0) {
          if (!opts.allowNegative) {
            throw new DurationParseError(
              'Negative values are not allowed',
              input,
              'NEGATIVE_NOT_ALLOWED',
            );
          }
          // Only allow negative in the first component for compound durations
          if (i > 0) {
            throw new DurationParseError(
              'Negative values only allowed on first component',
              input,
              'INVALID_NEGATIVE_POSITION',
            );
          }
        }

        const unit = this.normalizeUnit(
          unitStr.toLowerCase(),
          opts.ambiguousUnit,
        );

        // Check for duplicate units
        if (usedUnits.has(unit)) {
          throw new DurationParseError(
            `Duplicate unit "${unitStr}" in compound duration`,
            input,
            'DUPLICATE_UNIT',
            [
              'Each unit should appear only once',
              'Example: "1h 30m" not "1h 2h"',
            ],
          );
        }
        usedUnits.add(unit);

        const milliseconds = duration * TIME_MULTIPLIERS[unit];
        results.push({ duration, unit, milliseconds });
        totalMilliseconds += milliseconds;
      }

      return { totalMilliseconds, components: results };
    }

    // Single component
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

    return {
      totalMilliseconds: milliseconds,
      components: [{ duration, unit, milliseconds }],
    };
  }

  private _parseString(
    input: string,
    opts: Required<ParseOptions>,
  ): DetailedParseResult {}

  /**
   * Format milliseconds back to human-readable string
   */
  format(ms: number, options?: FormatOptions): string {
    const opts = { long: false, precision: 0, ...options };

    if (typeof ms !== 'number' || !isFinite(ms)) {
      throw new Error('Value must be a finite number');
    }

    const absMs = Math.abs(ms);
    // **ENHANCEMENT**: Explicit handling for zero.
    if (absMs === 0) {
      return opts.long ? '0 milliseconds' : '0ms';
    }

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

  getExpiresIn(input: string | number, options?: ParseOptions) {
    // Return the JWT support expire in second
    return Math.floor(this.parse(input, options) / 1000);
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
    // if (alias === 'm') {
    if (Array.from(AMBIGUOUS_UNITS).includes(alias)) {
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
      // **ENHANCEMENT**: Use advanced suggestion logic.
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

  // **ENHANCEMENT**: Helper for intelligent similar unit suggestions.
  private getSuggestionsForUnit(input: string): string[] {
    const aliases = Object.keys(UNIT_ALIASES);
    const inputLower = input.toLowerCase();

    return aliases
      .map((alias) => ({
        alias,
        // Calculate Levenshtein distance for similarity scoring
        score: this.levenshteinDistance(inputLower, alias),
      }))
      .sort((a, b) => a.score - b.score) // Sort by best score (lowest distance)
      .slice(0, 5) // Take the top 5 suggestions
      .map((item) => item.alias);
  }

  // **ENHANCEMENT**: Levenshtein distance implementation.
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // const matrix = Array(b.length + 1)
    //   .fill(null)
    //   .map(() => Array(a.length + 1).fill(null));

    // Create more explicit, and type-safe 2D array using Array.from to avoid unsafe assignments.
    // We fill the inner arrays with 0, as they will hold numbers.
    const matrix: number[][] = Array.from(
      { length: b.length + 1 },
      (): number[] => Array.from<number>({ length: a.length + 1 }).fill(0),
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // Deletion
          matrix[j - 1][i] + 1, // Insertion
          matrix[j - 1][i - 1] + cost, // Substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
}

// Export a default instance for convenience
export const durationParser = new TimeParserService();

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

/**
 * Get suggestions for similar units (basic fuzzy matching)
 */
// private getSuggestionsForUnit(input: string): string[] {
//   const aliases = Object.keys(UNIT_ALIASES);
//   const suggestions: string[] = [];

//   // Find exact prefix matches
//   for (const alias of aliases) {
//     if (alias.startsWith(input.toLowerCase())) {
//       suggestions.push(alias);
//     }
//   }

//   // If no prefix matches, find similar length matches
//   if (suggestions.length === 0) {
//     for (const alias of aliases) {
//       if (Math.abs(alias.length - input.length) <= 2) {
//         suggestions.push(alias);
//       }
//     }
//   }

//   return suggestions.slice(0, 5); // Limit suggestions
// }
