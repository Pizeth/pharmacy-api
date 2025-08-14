// import { Injectable } from '@nestjs/common';
// import { ParseOptions, TimeParserConfig } from 'src/types/time';

import { registerAs } from '@nestjs/config';
import {
  FormatOptions,
  LocalizationConfig,
  ParseOptions,
  TimeParserConfig,
} from '../types/time';
import path from 'path';

// @Injectable()
// export class TimeParserConfigService {
//   constructor(private readonly config: TimeParserConfig = {}) {}

//   get defaultParseOptions(): Required<ParseOptions> {
//     return {
//       ambiguousUnit: this.config.parseOptions?.ambiguousUnit ?? 'strict',
//       maxLength: this.config.maxInputLength ?? 100,
//       // ...other defaults
//     };
//   }
// }

export default registerAs('timeParser', (): TimeParserConfig => {
  // Default English localization
  const defaultLocalization: LocalizationConfig = {
    locale: 'en',
    units: {
      ms: { zero: 'just now', one: 'millisecond', other: 'milliseconds' },
      s: { one: 'second', other: 'seconds' },
      m: { one: 'minute', other: 'minutes' },
      h: { one: 'hour', other: 'hours' },
      d: { one: 'day', other: 'days' },
      w: { one: 'week', other: 'weeks' },
      mo: { one: 'month', other: 'months' },
      y: { one: 'year', other: 'years' },
    },
  };

  // Default Parse option
  const defaultParseOptions: Required<ParseOptions> = {
    ambiguousUnit: 'strict',
    maxLength: 100,
    allowNegative: false,
    strictNegativePosition: true,
    mergeDuplicates: false,
  };

  // Default format option
  const defaultFormatOptions: Required<FormatOptions> = {
    long: false,
    precision: -1,
    preferredUnits: [],
    compound: false,
    locale: defaultLocalization.locale,
    useIntl: true,
    separator: ' ',
  };

  const cfg = {
    maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH ?? '100'),
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE ?? '100'),
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'en',
    // enableSuggestions: process.env.ENABLE_SUGGESTIONS === 'true',
    enableSuggestions: true,
    localesPath:
      process.env.LOCALES_PATH ?? path.join(process.cwd(), 'src/i18n'),
    parseOptions: defaultParseOptions,
    formatOptions: defaultFormatOptions,
    preload: process.env.PRELOAD === 'true',
    useLocale: process.env.USE_LOCALE === 'true',
    localizationConfig: defaultLocalization,
  };

  return cfg;
});
