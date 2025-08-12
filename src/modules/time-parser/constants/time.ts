import { UnitTime } from 'src/types/commons.enum';
import { RelativeTimeUnit } from '../types/time';

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

export const RELATIVE_TIME_UNITS: Record<UnitTime, RelativeTimeUnit> = {
  ms: 'second', // Fallback for milliseconds
  s: 'second',
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
  mo: 'month',
  y: 'year',
};

// Ambiguous units that should be explicitly handled
export const AMBIGUOUS_UNITS = new Set(['m']);
