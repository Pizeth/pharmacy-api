// -----------------------------------------------------------------
// Core Constants and Types
// Location: src/utils/time-parser.constants.ts
// -----------------------------------------------------------------
// We'll move the constants and types into their own file for better organization.

// Time multipliers (in milliseconds)
export const TIME_MULTIPLIERS = {
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
export const UNIT_ALIASES: Record<string, UnitTime> = {
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

// Supported For Intl.RelativeTimeFormat units
type RelativeTimeUnit = Exclude<Intl.RelativeTimeFormatUnit, 'quarter'>;
const RELATIVE_TIME_UNITS: Record<UnitTime, RelativeTimeUnit> = {
  ms: 'second', // Fallback for milliseconds
  s: 'second',
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
  mo: 'month',
  y: 'year',
};

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

// Ambiguous units that should be explicitly handled
export const AMBIGUOUS_UNITS = new Set(['m']);

// Configuration interface
export interface TimeParserConfig {
  maxInputLength?: number;
  maxCacheSize?: number;
  defaultLocale?: string;
  enableSuggestions?: boolean;
  localesPath?: string;
  parseOptions?: ParseOptions;
  formatOptions?: FormatOptions;
  localizationConfig?: LocalizationConfig;
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

// Define plural categories based on Intl.PluralRules
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

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
interface LocalizationConfig {
  locale: string;
  units: Record<UnitTime, UnitLocalization>;
}

// The result for a single parsed component
export interface ParseResult {
  duration: number;
  unit: UnitTime;
  milliseconds: number;
}

export type DominantUnit = Omit<ParseResult, 'milliseconds'>;

// The result for the detailed parse method
export interface DetailedParseResult {
  totalMilliseconds: number;
  dominantUnit?: DominantUnit;
  data: ParseResult[];
}
