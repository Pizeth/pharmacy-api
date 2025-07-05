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

// Ambiguous units that should be explicitly handled
export const AMBIGUOUS_UNITS = new Set(['m']);

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

  /**
   * Preferred units in order of precedence
   */
  preferredUnits?: UnitTime[];
}

// The result for a single parsed component
export interface ParseResult {
  duration: number;
  unit: UnitTime;
  milliseconds: number;
}

// **NEW**: The result for the detailed parse method
export interface DetailedParseResult {
  totalMilliseconds: number;
  data: ParseResult[];
}
