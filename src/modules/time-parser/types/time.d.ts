// -----------------------------------------------------------------
// Core Constants and Types
// Location: src/utils/time-parser.constants.ts
// -----------------------------------------------------------------
// We'll move the constants and types into their own file for better organization.
import { TIME_MULTIPLIERS } from '../constants/time';

// Base unit type
export type UnitTime = keyof typeof TIME_MULTIPLIERS;

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
