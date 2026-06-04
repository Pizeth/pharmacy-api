import { TIME_MULTIPLIERS } from '../constants/time';
import { ParseResult } from '../interfaces/time.interface';

// Base unit type
type UnitTime = keyof typeof TIME_MULTIPLIERS;

// Supported For Intl.RelativeTimeFormat units
type RelativeTimeUnit = Exclude<Intl.RelativeTimeFormatUnit, 'quarter'>;

type DominantUnit = Omit<ParseResult, 'milliseconds'>;
// Define plural categories based on Intl.PluralRules
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

// type CanonicalUnit =
//   | 'day'
//   | 'hour'
//   | 'minute'
//   | 'second'
//   | 'millisecond'
//   | 'microsecond';
