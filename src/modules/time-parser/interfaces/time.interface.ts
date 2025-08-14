// -----------------------------------------------------------------
// Core Constants and Types
// Location: src/utils/time-parser.constants.ts
// -----------------------------------------------------------------
// We'll move the constants and types into their own file for better organization.

import { DominantUnit, UnitTime } from '../types/time';

// export const LONG_NAMES: Record<UnitTime, string> = {
//   ms: 'millisecond',
//   s: 'second',
//   m: 'minute',
//   h: 'hour',
//   d: 'day',
//   w: 'week',
//   mo: 'month',
//   y: 'year',
// };

// const mapping: Record<UnitTime, Intl.RelativeTimeFormatUnit> = {
//   s: 'second',
//   m: 'minute',
//   h: 'hour',
//   d: 'day',
//   w: 'week',
//   mo: 'month',
//   y: 'year',
//   ms: 'second', // Fallback for milliseconds
// };

// Configuration interface
export interface TimeParserConfig {
  maxInputLength: number;
  maxCacheSize: number;
  defaultLocale: string;
  enableSuggestions: boolean;
  localesPath: string;
  parseOptions: ParseOptions;
  formatOptions: FormatOptions;
  preload: boolean;
  useLocale: boolean;
  localizationConfig: LocalizationConfig;
}

// Options interface
export interface ParseOptions {
  // Defaults to 'millisecond'.
  defaultUnit?: UnitTime;
  // Try hh:mm:ss(.ms) and mm:mm(.ms) first.
  allowTimestamp?: boolean;
  // Accept comma decimals ("1,5h") as well as dots.
  decimalSeparator?: '.' | ',';
  // If true, unknown tokens cause errors; otherwise they’re ignored with warnings.
  strict?: boolean;
  // If provided, only these units are accepted (others are ignored/errored).
  allowedUnits?: UnitTime[];
  /**
   * How to handle ambiguous units like 'm' (minutes vs months)
   * - 'strict': Throw error for ambiguous units
   * - 'minutes': Interpret 'm', 'mn' as minutes
   * - 'months': Interpret 'm', 'mn' as months
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
  strictNegativePosition?: boolean;
  mergeDuplicates?: boolean;
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

  /**
   * Preferred units in order of precedence
   */
  preferredUnits?: UnitTime[];

  /**
   * Option for multi-unit output and sorted preferredUnits by size.
   */
  compound?: boolean;

  /**
   * Option for localization
   */
  locale?: string;

  /**
   * Option for using Intl.RelativeTimeFormat for Localized Output via Web API
   */
  useIntl?: boolean;

  /**
   * Option for custom serparator. e.g., ", ", " and ", etc.
   */
  separator?: string;
}

// Localization for a single unit, requiring 'other' as a fallback
interface UnitLocalization {
  other: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
}

// Configuration for localization, including locale and unit mappings
export interface LocalizationConfig {
  locale: string;
  units: Record<UnitTime, UnitLocalization>;
}

// The result for a single parsed component
export interface ParseResult {
  duration: number;
  unit: UnitTime;
  milliseconds: number;
}

// interface ParseResult {
//   ok: boolean;
//   totalMs: number;
//   components: ParsedComponent[];
//   rest: string; // leftover, unparsed text
//   warnings: string[];
//   errors: string[];
// }

// The result for the detailed parse method
export interface DetailedParseResult {
  totalMilliseconds: number;
  dominantUnit?: DominantUnit;
  data: ParseResult[];
}

export interface Component {
  value: number;
  unit: string | undefined;
}

// interface ParsedComponent {
//   raw: string;
//   value: number;
//   unit: CanonicalUnit;
//   ms: number;
// }
