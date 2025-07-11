// -----------------------------------------------------------------
// The Duration Parser Service
// Location: src/modules/time-parser/services/time-parser.service.ts
// -----------------------------------------------------------------
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Duration } from 'luxon';
import path from 'path';
import fs, { promises } from 'fs';
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
  LONG_NAMES,
  LocalizationConfig,
  PluralCategory,
  TimeParserConfig,
} from 'src/types/time';

@Injectable()
/**
 * Service for parsing, formatting, and localizing human-readable time durations.
 *
 * The `TimeParserService` provides robust utilities to:
 * - Parse duration strings (e.g., "1h 30m", "2d", ISO-8601, numbers) into milliseconds.
 * - Format milliseconds into human-readable strings, with support for localization and pluralization.
 * - Handle ambiguous units (e.g., "m" for minutes or months) with configurable strategies.
 * - Support compound durations, negative values (optionally), and safe integer boundaries.
 * - Add or load localization data for different languages at runtime.
 * - Suggest corrections for unknown or mistyped units.
 * - Validate duration strings and retrieve supported units.
 * - Calculate expiration dates or intervals based on parsed durations.
 *
 * Features:
 * - ISO-8601 duration support.
 * - Customizable parsing and formatting options.
 * - Intelligent error handling with suggestions and detailed error codes.
 * - Caching and merging of localization files for efficient lookups.
 *
 * Example usage:
 * ```typescript
 * const parser = new TimeParserService();
 * const ms = parser.parse('2h 30m'); // 9000000
 * const str = parser.format(ms, { long: true }); // "2 hours"
 * const localized = parser.format(ms, { locale: 'fr', long: true }); // "2 heures"
 * ```
 */
export class TimeParserService implements OnModuleInit {
  private readonly context = TimeParserService.name;
  private readonly logger = new Logger(this.context);

  // Configuration
  private readonly config: Required<TimeParserConfig>;

  // Pre‑sorted [unit, multiplier] descending
  private readonly sortedUnits: [UnitTime, number][];

  // Default Parse option
  private readonly defaultParseOptions: Required<ParseOptions> = {
    ambiguousUnit: 'strict',
    maxLength: 100,
    allowNegative: false,
    strictNegativePosition: true,
    mergeDuplicates: false,
  };

  // Default English localization
  private readonly defaultLocalization: LocalizationConfig = {
    locale: 'en',
    units: {
      ms: { one: 'millisecond', other: 'milliseconds' },
      s: { one: 'second', other: 'seconds' },
      m: { one: 'minute', other: 'minutes' },
      h: { one: 'hour', other: 'hours' },
      d: { one: 'day', other: 'days' },
      w: { one: 'week', other: 'weeks' },
      mo: { one: 'month', other: 'months' },
      y: { one: 'year', other: 'years' },
    },
  };

  // Cache for loaded localizations
  private readonly localizationCache = new Map<string, LocalizationConfig>();

  // Cache for unit suggestions
  private readonly suggestionCache = new Map<string, string[]>();

  // Cache for unit levenshtein distance
  private readonly levenshteinCache = new Map<string, number>();

  // Cache for international plural
  private readonly pluralRulesCache = new Map<string, Intl.PluralRules>();

  private localesPath: string;

  // constructor(localesPath: string = path.join(__dirname, 'src/i18n')) {
  constructor(config: TimeParserConfig = {}, preload: boolean = false) {
    /**
     * Lazily build a precompute sorted units once for efficient formatting [unit, multiplier] tuple list
     * from TIME_MULTIPLIERS. Sorted descending (largest unit first).
     */
    this.sortedUnits = (
      Object.entries(TIME_MULTIPLIERS) as [UnitTime, number][]
    ).sort(([, a], [, b]) => b - a);

    this.config = {
      maxInputLength: config.maxInputLength ?? 100,
      maxCacheSize: config.maxCacheSize ?? 100,
      defaultLocale: config.defaultLocale ?? 'en',
      enableSuggestions: config.enableSuggestions ?? true,
      localesPath: config.localesPath ?? path.join(process.cwd(), 'src/i18n'),
    };

    this.localesPath = this.config.localesPath;

    // Preload default localization
    this.localizationCache.set('en', this.defaultLocalization);

    // Override default parse options with config values
    this.defaultParseOptions.maxLength = this.config.maxInputLength;

    if (preload) {
      this.preloadLocalizations();
    }
  }

  // called by Nest once all DI is wired up
  async onModuleInit(): Promise<void> {
    await this.preloadLocalesAsync();
  }

  // =============== MAIN API METHODS =============== //

  // ————————————— Parsing —————————————

  /**
   * Parse a duration string or number into milliseconds.
   * This is the main parsing method, containing your robust logic.
   */
  parse(input: string | number, options?: ParseOptions): number {
    const opts = { ...this.defaultParseOptions, ...options };
    const { totalMilliseconds } = this.parseDetailed(input, opts);
    return totalMilliseconds;
  }

  /**
   * Parse with detailed result information
   */
  parseDetailed(
    input: string | number,
    options?: ParseOptions,
  ): DetailedParseResult {
    const opts = { ...this.defaultParseOptions, ...options };

    // 1) Number
    if (typeof input === 'number') {
      return this.parseNumeric(input, opts);
    }

    // Ensure string
    this.validateInput(input, opts);

    const trimmed = input.trim();

    // Handle pure numbers and support for scientific notation (treat as milliseconds)
    if (/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) {
      return this.parseNumeric(trimmed, opts);
    }

    // ISO‑8601
    if (/^P/i.test(trimmed)) {
      this.parseISODuration(input, opts);
    }

    // Handle compound durations (e.g., "1h 30m", "2d 4h 30m") - return array of components
    const components = trimmed.split(/\s+/);

    return components.length > 1
      ? this.parseCompoundDuration(components, opts)
      : this.parseSingleDuration(trimmed, opts);
  }

  // ————————————— Formatting —————————————

  /**
   * Formats a duration given in milliseconds into a human-readable string.
   *
   * @param ms - The duration in milliseconds to format.
   * @param options - Formatting options, including:
   *   - `long`: Whether to use a long, localized format (default: `false`).
   *   - `precision`: Number of decimal places to include (default: `0`).
   *   - `preferredUnits`: Array of preferred time units to use for formatting.
   *   - `locale`: Optional locale string to use for localization (defaults to the configured locale 'en').
   * @returns The formatted duration string.
   * @throws {DurationParseError} If the input value is not a finite number.
   */
  format(
    ms: number,
    options: FormatOptions & { locale?: string } = {},
  ): string {
    const opts = {
      long: false,
      precision: -1,
      preferredUnits: [],
      compound: false,
      locale: this.config.defaultLocale,
      ...options,
    };

    // Validate input
    if (typeof ms !== 'number' || !isFinite(ms)) {
      throw new DurationParseError(
        'Value must be a finite number',
        String(ms),
        'INVALID_NUMBER',
      );
    }

    // Load localization
    const localization = this.getLocalization(opts.locale);
    const absMs = Math.abs(ms);
    const sign = ms < 0 ? '-' : '';

    // Explicit handling for zero.
    if (absMs === 0) {
      return opts.long ? this.formatLong('ms', absMs, localization) : '0ms';
    }

    // Find the most appropriate unit
    // const [unit, roundedValue /*, sign*/] = this.findBestUnit(absMs, opts);
    const result = this.findBestUnit(absMs, opts);

    if (result.length === 1) {
      const [unit, value] = result[result.length - 1];
      // Handle long format with localization
      return opts.long
        ? `${sign}${this.formatLong(unit, value, localization)}`
        : `${sign}${Math.abs(value)}${unit}`;
    } else {
      // const parts: string[] = [];
      // for (const [unit, value] of result) {
      //   parts.push(this.formatLong(value, unit, localization));
      // }
      // return sign + parts.join(' ');
      return `${sign} 
        ${result
          .map(([unit, value]) => this.formatLong(unit, value, localization))
          .join(options.compound ? ' ' : '')}`;
    }

    // Handle long format with localization
    // return opts.long
    //   ? this.formatLong(roundedValue, unit, localization)
    //   : `${sign}${Math.abs(roundedValue)}${unit}`;
  }

  // =============== Helpers ===============

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

  // =============== PUBLIC UTILITIES =============== //

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
   * Add a localization at runtime
   */
  addLocalization(config: LocalizationConfig): void {
    const mergedConfig = this.mergeLocalizationConfig(config);
    this.addToCache(this.localizationCache, config.locale, mergedConfig);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.localizationCache.clear();
    this.suggestionCache.clear();
    // Re-add default localization
    this.localizationCache.set('en', this.defaultLocalization);
  }

  // =============== NEW FEATURES =============== //
  /**
   * Parse multiple durations efficiently
   */
  batchParse(inputs: (string | number)[], options?: ParseOptions): number[] {
    return inputs.map((input) => this.parse(input, options));
  }

  /**
   * Preload locales asynchronously for better performance
   */
  private async preloadLocalesAsync(): Promise<void> {
    // await Promise.all(
    //   locales.map(async (locale) => {
    //     try {
    //       await this.loadLocalizationAsync(locale);
    //     } catch (error: unknown) {
    //       this.logger.warn(`Failed to preload locale ${locale}:`, error);
    //     }
    //   }),
    // );

    try {
      const locales = await promises.readdir(this.localesPath);
      // Filter for .json, strip extension, and load in parallel
      await Promise.all(
        locales
          .filter((file) => file.endsWith('.json'))
          .map(async (file) => {
            const locale = file.slice(0, -5); // remove “.json”
            return await this.loadLocalizationAsync(locale);
          }),
      );
    } catch (error: unknown) {
      Logger.error(`Failed to read locales directory`, error);
      throw new Error(`Failed to read locales dir:`);
    }
  }

  private preloadLocalizations(): void {
    const files = fs.readdirSync(this.localesPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const locale = file.replace('.json', '');
        this.getLocalization(locale);
      }
    }
  }

  // =============== Private HELPER METHODS =============== //

  private parseNumeric(
    input: string | number,
    options: Required<ParseOptions>,
  ): DetailedParseResult {
    const result = this.validateNumber(String(input), options);
    return {
      totalMilliseconds: result,
      data: [{ duration: result, unit: 'ms', milliseconds: result }],
    };
  }

  private parseISODuration(
    input: string,
    options: Required<ParseOptions>,
  ): DetailedParseResult {
    const isNegative = input.startsWith('-');
    const isoString = isNegative ? input.slice(1) : input;

    const duration = Duration.fromISO(isoString);
    this.logger.debug('Parsed ISO duration', { input, duration });

    if (!duration.isValid) {
      throw new DurationParseError(
        `Invalid ISO-8601 format: ${input}`,
        input,
        'INVALID_ISO',
        ['Example: PT1H30M for 1 hour 30 minutes'],
      );
    }

    const milliseconds = duration.as('milliseconds');

    if (!options.allowNegative && isNegative) {
      throw new DurationParseError(
        'Negative ISO-8601 durations are not allowed',
        input,
        'NEGATIVE_ISO_NOT_ALLOWED',
      );
    }

    return {
      totalMilliseconds: milliseconds,
      data: [
        {
          duration: milliseconds,
          unit: 'ms',
          milliseconds: isNegative ? -milliseconds : milliseconds,
        },
      ],
    };
  }

  private parseSingleDuration(
    trimmed: string,
    options: Required<ParseOptions>,
  ): DetailedParseResult {
    const data = this.parseComponent(trimmed, options);
    return {
      totalMilliseconds: data.milliseconds,
      data: [data],
    };
  }

  private parseCompoundDuration(
    components: string[],
    options: Required<ParseOptions>,
  ): DetailedParseResult {
    const data: ParseResult[] = [];
    const usedUnits = new Set<UnitTime>();
    let dominantUnit: UnitTime = 'ms';
    // let maxMultiplier = 0;

    const totalMilliseconds = components.reduce((sum, component, index) => {
      // Skip empty components
      if (!component) return sum;

      // Parse each component individually here
      const result = this.parseComponent(component, options, index, usedUnits);
      usedUnits.add(result.unit);
      data.push(result);

      // Track unit with largest multiplier for dominant unit
      // const multiplier = TIME_MULTIPLIERS[data.unit];
      // if (multiplier > maxMultiplier) {
      //   maxMultiplier = multiplier;
      //   dominantUnit = data.unit;
      // }
      if (TIME_MULTIPLIERS[result.unit] > TIME_MULTIPLIERS[dominantUnit]) {
        dominantUnit = result.unit;
      }

      return sum + result.milliseconds;
    }, 0);

    // const [dominantUnit] = this.sortedUnits.find(
    //   ([_, multiplier]) => totalMilliseconds >= multiplier,
    // ) || ['ms', 1];

    return {
      totalMilliseconds,
      dominantUnit: {
        duration: totalMilliseconds / TIME_MULTIPLIERS[dominantUnit],
        unit: dominantUnit,
      },
      data,
    };
  }

  private parseComponent(
    input: string,
    options: Required<ParseOptions>,
    index: number = 0,
    usedUnits: Set<UnitTime> = new Set<UnitTime>(),
  ): ParseResult {
    // Enhanced regex to handle scientific notation and various formats in components
    const match = input.match(/^(-?\d*\.?\d+(?:e[+-]?\d+)?)\s*([a-zA-Z]+)$/);
    if (!match) {
      throw new DurationParseError(
        `Invalid duration format at position ${index}: "${input}"`,
        input,
        'INVALID_FORMAT',
        [
          'Examples of valid formats: "1h", "30m", "1.5d", "2 hours"',
          index > 0 ? `Full compound duration being parsed` : '',
        ].filter(Boolean),
      );
    }

    const [, numStr, unitStr] = match;

    // Validate and return the absolute value of duration
    const duration = this.validateNumber(numStr, options, index);

    const unit = this.normalizeUnit(
      unitStr.toLowerCase(),
      options.ambiguousUnit,
    );

    // Check for duplicate units
    if (usedUnits.has(unit) && !options.mergeDuplicates)
      throw new DurationParseError(
        `Duplicate unit "${unitStr}" in compound duration`,
        input,
        'DUPLICATE_UNIT',
        ['Each unit should appear only once', 'Example: "1h 30m" not "1h 2h"'],
      );

    const milliseconds = duration * TIME_MULTIPLIERS[unit];

    // Boundary case handling for safe integers.
    if (Math.abs(milliseconds) > Number.MAX_SAFE_INTEGER) {
      throw new DurationParseError(
        'Value exceeds safe integer limit',
        input,
        'VALUE_TOO_LARGE',
      );
    }

    return { duration, unit, milliseconds };
  }

  private formatLong(
    unit: UnitTime,
    value: number,
    localization: LocalizationConfig,
  ): string {
    // Check and assign the sign to value
    // const sign = value < 0 ? '-' : '';

    // Get cached plural rules
    const pluralRules = this.getPluralRules(localization.locale);
    const pluralCategory = pluralRules.select(value) as PluralCategory;

    // Get unit localization
    const unitLocalization = localization.units[unit];
    if (!unitLocalization) {
      throw new DurationParseError(
        `Missing localization for unit: ${unit}`,
        unit,
        'MISSING_LOCALIZATION',
      );
    }

    // Get localized unit name
    const localeUnit =
      unitLocalization[pluralCategory] || unitLocalization.other;

    if (!localeUnit) {
      throw new DurationParseError(
        `No '${pluralCategory}' or 'other' form for unit: ${unit}`,
        unit,
        'MISSING_PLURAL_FORM',
      );
    }

    return `${value} ${localeUnit}`;
  }

  // private formatLong(
  //   value: number,
  //   unit: UnitTime,
  //   localization: Record<string, string>,
  // ): string {
  //   const key = value === 1 ? `${unit}_singular` : `${unit}_plural`;
  //   const template =
  //     localization[key] || (value === 1 ? `${unit}` : `${unit}s`);
  //   return `${value} ${template}`;
  // }

  private findBestUnit(
    input: number,
    // preferredUnits: UnitTime[],
    // precision: number,
    options: Required<FormatOptions>,
  ): [UnitTime, number][] {
    // const sign = input < 0 ? '-' : '';
    // const absMs = Math.abs(input);
    // Predefined unit search order
    const searchOrder = this.sortedUnits;

    // Use preferred units if specified
    const unitsToSearch =
      options.preferredUnits.length > 0
        ? searchOrder
            .filter(([unit]) => options.preferredUnits.includes(unit))
            .sort((a, b) => b[1] - a[1])
        : searchOrder;

    // Find the largest unit that fits
    let remaining = Math.abs(input);
    const parts: [UnitTime, number][] = [];
    for (const [unit, multiplier] of unitsToSearch) {
      if (remaining < multiplier) continue;

      if (options.compound) {
        // compound: take as many of this unit as you can
        const count = Math.floor(remaining / multiplier);
        remaining -= count * multiplier;
        parts.push([unit, count]);
        // continue to next unit until remaining < smallest multiplier
      } else {
        // non-compound: just compute once and break
        const value = remaining / multiplier;

        const roundedValue =
          options.precision != null
            ? parseFloat(value.toFixed(options.precision))
            : Math.round(value);

        parts.push([unit, roundedValue]);
        break;
      }
      // if (input >= multiplier) {
      //   // Calculate the count for the selected unit
      //   const value = input / multiplier;
      //   const roundedValue =
      //     options.precision >= 0
      //       ? parseFloat(value.toFixed(options.precision))
      //       : Math.round(value);
      //   return [unit, roundedValue /*sign*/];
      // }
      return parts;
    }

    // if nothing matched (input was 0 or less than smallest unit), force one 0-amount
    // if (parts.length === 0) {
    //   const [smallestUnit] = this.sortedUnits[this.sortedUnits.length - 1];
    //   parts.push([smallestUnit, 0]);
    // }

    // // —— now format ——
    // if (options.long) {
    //   // long form: “1 hour 30 minutes” or “2 days”
    //   return (
    //     sign +
    //     parts
    //       .map(([u, v]) => this.formatLong(v, u, localization))
    //       .join(options.compound ? ' ' : '')
    //   );
    // } else {
    //   // short form: “1.5h” or “2d”
    //   const [[u, v]] = parts; // only the first part matters
    //   const numStr =
    //     options.precision != null ? v.toFixed(options.precision) : String(v);
    //   return sign + numStr + u;
    // }

    // Return default in millisecond
    return [['ms', Math.round(input)]];
  }

  // =============== SECURITY & PERFORMANCE =============== //
  private getPluralRules(locale: string): Intl.PluralRules {
    if (!this.pluralRulesCache.has(locale)) {
      this.pluralRulesCache.set(
        locale,
        new Intl.PluralRules(this.isValidLocale(locale) ? locale : 'en'),
      );
    }
    return this.pluralRulesCache.get(locale)!;
  }

  private isValidLocale(locale: string): boolean {
    try {
      // Will throw if locale is invalid
      new Intl.PluralRules(locale);
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        `Invalid locale: ${locale}, falling back to 'en'`,
        error,
      );
      return false;
    }
  }

  private async loadLocalizationAsync(
    locale: string,
  ): Promise<LocalizationConfig> {
    if (this.localizationCache.has(locale)) {
      return this.localizationCache.get(locale)!;
    }

    try {
      const filePath = this.resolveLocalePath(locale);
      const data = await fs.promises.readFile(filePath, 'utf8');
      return this.processLocaleData(data, locale);
    } catch (error) {
      this.logger.warn(
        `Failed to load localization for "${locale}", falling back to default.`,
        error,
      );
      return this.handleLocaleFallback(locale);
    }
  }

  private resolveLocalePath(locale: string): string {
    const filePath = path.join(this.localesPath, `${locale}/${locale}.json`);
    // Security: Prevent path traversal
    if (!filePath.startsWith(path.resolve(this.localesPath))) {
      throw new Error(`Invalid locale path: ${locale}`);
    }
    return filePath;
  }

  private addToCache<T>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= this.config.maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    cache.set(key, value);
  }

  // =============== ERROR HANDLING & UTILITIES =============== //
  private validateInput(input: string, options: Required<ParseOptions>): void {
    if (typeof input !== 'string' || input.length === 0) {
      throw new DurationParseError(
        'Input must be a non-empty string',
        String(input),
        'EMPTY_INPUT',
      );
    }

    if (input.length > options.maxLength) {
      throw new DurationParseError(
        `Input exceeds maximum length of ${options.maxLength}`,
        input,
        'INPUT_TOO_LONG',
      );
    }

    // Check for potentially malicious patterns
    if (/[<>{}[\]\\]/.test(input)) {
      throw new DurationParseError(
        'Invalid characters in input',
        input,
        'INVALID_CHARACTERS',
        ['Input contains potentially unsafe characters'],
      );
    }
  }

  private validateNumber(
    input: string,
    options: Required<ParseOptions>,
    position: number = 0,
  ): number {
    const num = parseFloat(input);

    if (!isFinite(num))
      throw new DurationParseError(
        `Invalid number "${num}" in format "${input}"`,
        input,
        'INVALID_NUMBER',
      );

    //  Safe boundy for integer
    const isSafeInt = Math.abs(num) <= Number.MAX_SAFE_INTEGER;

    if (!isSafeInt)
      throw new DurationParseError(
        'Value exceeds safe integer limit',
        String(input),
        'VALUE_TOO_LARGE',
      );

    if (num >= 0) return num;

    // Track if number have any negative values
    if (!options.allowNegative) {
      throw new DurationParseError(
        'Negative values are not allowed',
        input,
        'NEGATIVE_NOT_ALLOWED',
      );
    }

    if (position > 0) {
      throw new DurationParseError(
        'Negative values only allowed on first component',
        input,
        'INVALID_NEGATIVE_POSITION',
      );
    }

    return num;
  }

  /**
   * Normalize unit aliases to canonical units
   */
  private normalizeUnit(
    alias: string,
    ambiguousHandling: 'strict' | 'minutes' | 'months',
  ): UnitTime {
    // Handle ambiguous unit
    if (AMBIGUOUS_UNITS.has(alias)) {
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
      // Use advanced suggestion logic if suggestion is enable in the options.
      const suggestions = this.config.enableSuggestions
        ? this.getSuggestionsForUnit(alias)
        : [];
      throw new DurationParseError(
        `Unknown unit "${alias}"`,
        alias,
        'UNKNOWN_UNIT',
        suggestions.length > 0
          ? [`Did you mean: "${suggestions.slice(0, 3).join(', ')}"?`]
          : [],
      );
    }

    return unit;
  }

  // Helper for intelligent similar unit suggestions.
  private getSuggestionsForUnit(input: string): string[] {
    // Check if suggestion already cached
    if (this.suggestionCache.has(input)) {
      return this.suggestionCache.get(input)!;
    }

    const aliases = Object.keys(UNIT_ALIASES);
    const inputLower = input.toLowerCase();

    // const suggestion = this.sortedUnits.find(
    //   ([u]) => this.levenshteinDistance(inputLower, u) <= 2,
    // )?.[0];

    const suggestions = aliases
      .map((alias) => ({
        alias,
        // Calculate Levenshtein distance for similarity scoring
        score: this.levenshteinDistance(inputLower, alias),
      }))
      .sort((a, b) => a.score - b.score) // Sort by best score (lowest distance)
      .slice(0, 5) // Take the top 5 suggestions
      .map((item) => item.alias);

    // Add the suggestion to cache to improve performance
    this.addToCache(this.suggestionCache, input, suggestions);
    return suggestions;
  }

  // Levenshtein distance implementation.
  private levenshteinDistance(
    a: string,
    b: string,
    threshold: number = 5,
  ): number {
    // Create consistent key regardless of parameter order
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;

    // Check if levenshtein distance already cached
    if (this.levenshteinCache.has(key)) {
      return this.levenshteinCache.get(key)!;
    }

    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Create more explicit, and type-safe 2D array using Array.from to avoid unsafe assignments.
    // Fill the inner arrays with 0, as they will hold numbers.
    // const matrix: number[][] = Array.from(
    //   { length: b.length + 1 },
    //   (): number[] => Array.from<number>({ length: a.length + 1 }).fill(0),
    // );

    // for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    // for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    // Create more explicit, and type-safe 2D array using Array.from to avoid unsafe assignments.
    const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) =>
        i === 0 ? j : j === 0 ? i : 0,
      ),
    );

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // Deletion
          matrix[j - 1][i] + 1, // Insertion
          matrix[j - 1][i - 1] + cost, // Substitution
        );
      }
      const minInRow = Math.min(...matrix[j].slice(0, a.length + 1));
      if (minInRow > threshold) return minInRow;
    }

    const distance = matrix[b.length][a.length];
    // Add the levenshtein distance to cache to improve performance
    this.addToCache(this.levenshteinCache, key, distance);
    return distance;
  }

  /**
   * Load localization with caching and fallbacks
   */
  private getLocalization(locale: string): LocalizationConfig {
    if (this.localizationCache.has(locale)) {
      return this.localizationCache.get(locale)!;
    }

    try {
      const filePath = this.resolveLocalePath(locale);
      const data = fs.readFileSync(filePath, 'utf8');
      return this.processLocaleData(data, locale);
    } catch (error) {
      this.logger.warn(
        `Failed to load localization for "${locale}", falling back to default.`,
        error,
      );
      return this.handleLocaleFallback(locale);
    }
  }

  private parseLocalizationFile(data: string): LocalizationConfig {
    try {
      const parsed: unknown = JSON.parse(data);

      // Basic validation
      if (!this.isLocalizationConfig(parsed)) {
        throw new Error('JSON does not match LocalizationConfig');
      }

      return parsed;
    } catch (error) {
      throw new DurationParseError(
        `Failed to parse localization file: ${(error as Error).message}`,
        data,
        'NOT_VALID_LOCALIZATION_CONFIG',
        [
          'LocalizationConfig structure:',
          'locale:<string>',
          'unit:Record<UnitTime, UnitLocalization>',
        ],
      );
    }
  }

  private processLocaleData(data: string, locale: string): LocalizationConfig {
    // Validate JSON structure
    const config = this.parseLocalizationFile(data);

    // Merge with default to ensure all units are present
    const mergedConfig = this.mergeLocalizationConfig(config);

    // Add locale to cache for better performance
    this.addToCache(this.localizationCache, locale, mergedConfig);
    return mergedConfig;
  }

  private handleLocaleFallback(locale: string): LocalizationConfig {
    // Fallback strategies
    if (locale.includes('-')) {
      const baseLocale = locale.split('-')[0];
      if (baseLocale !== locale && baseLocale !== 'en') {
        return this.getLocalization(baseLocale);
      }
    }
    // Fallback to default local 'en'
    return this.defaultLocalization;
  }

  private isLocalizationConfig(data: unknown): data is LocalizationConfig {
    if (typeof data !== 'object' || data === null) return false;
    const config = data as Record<string, unknown>;
    return (
      typeof config['locale'] === 'string' &&
      typeof config['units'] === 'object' &&
      config['units'] !== null
    );
  }

  private mergeLocalizationConfig(
    config: LocalizationConfig,
  ): LocalizationConfig {
    return {
      ...this.defaultLocalization,
      ...config,
      units: {
        ...this.defaultLocalization.units,
        ...config.units,
      },
    };
  }
}

// Export a default singleton instance for convenience
export const durationParser = new TimeParserService();

// Convenience Vercel ms-compatible function that match the ms library API
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

// if (typeof input === 'number') {
//   if (!opts.allowNegative && input < 0) {
//     throw new DurationParseError(
//       'Negative values are not allowed',
//       input.toString(),
//       'NEGATIVE_NOT_ALLOWED',
//     );
//   }
//   return input;
// }

// if (typeof input !== 'string' || input.length === 0) {
//   throw new DurationParseError(
//     'Input must be a non-empty string',
//     String(input),
//     'INVALID_TYPE',
//   );
// }

// if (input.length > opts.maxLength) {
//   throw new DurationParseError(
//     `Input exceeds maximum length of ${opts.maxLength}`,
//     input,
//     'INPUT_TOO_LONG',
//   );
// }

// const trimmed = input.trim();

// // Handle pure numbers (treat as milliseconds)
// if (/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) {
//   const num = parseFloat(trimmed);
//   if (!opts.allowNegative && num < 0) {
//     throw new DurationParseError(
//       'Negative values are not allowed',
//       input,
//       'NEGATIVE_NOT_ALLOWED',
//     );
//   }
//   return num;
// }

// // **ENHANCEMENT**: Handle compound durations (e.g., "1h 30m", "2d 4h 30m")
// const components = trimmed.split(/\s+/).filter((c) => c.length > 0); // Filter out empty strings
// if (components.length > 1) {
//   let totalMs = 0;
//   const usedUnits = new Set<UnitTime>();
//   // let hasNegativeComponent = false;

//   for (let i = 0; i < components.length; i++) {
//     const component = components[i];

//     // Skip empty components
//     if (!component) continue;

//     // We can't recursively call `this.parse` as it would re-split.
//     // We parse each component individually here.
//     const match = component.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
//     if (!match) {
//       throw new DurationParseError(
//         `Invalid duration component: "${component}"`,
//         input,
//         'INVALID_FORMAT',
//         [
//           'Each component should be in the format: <number><unit> (e.g., "1h", "30m")',
//           'Examples: "1h 30m", "2d 4h 30m", "1.5h"',
//         ],
//       );
//     }

//     const [, numStr, unitStr] = match;
//     const duration = parseFloat(numStr);
//     if (!isFinite(duration))
//       throw new DurationParseError(
//         `Invalid number in component "${component}"`,
//         input,
//         'INVALID_NUMBER',
//       );

//     // Track if we have any negative values
//     if (duration < 0) {
//       if (!opts.allowNegative) {
//         throw new DurationParseError(
//           'Negative values are not allowed',
//           input,
//           'NEGATIVE_NOT_ALLOWED',
//         );
//       }
//       // Only allow negative in the first component for compound durations
//       if (i > 0) {
//         throw new DurationParseError(
//           'Negative values only allowed on first component',
//           input,
//           'INVALID_NEGATIVE_POSITION',
//         );
//       }
//     }

//     const unit = this.normalizeUnit(unitStr.toLowerCase(), opts.ambiguousUnit);

//     // Check for duplicate units
//     if (usedUnits.has(unit)) {
//       throw new DurationParseError(
//         `Duplicate unit "${unitStr}" in compound duration`,
//         input,
//         'DUPLICATE_UNIT',
//         ['Each unit should appear only once', 'Example: "1h 30m" not "1h 2h"'],
//       );
//     }
//     usedUnits.add(unit);

//     totalMs += duration * TIME_MULTIPLIERS[unit];
//   }
//   return totalMs;
// }

// // Enhanced regex to handle various formats
// const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
// if (!match) {
//   throw new DurationParseError(
//     'Invalid duration format',
//     input,
//     'INVALID_FORMAT',
//     ['Examples of valid format: "1h", "30m", "1.5d", "2 hours"'],
//   );
// }

// const [, numStr, unitStr] = match;
// const num = parseFloat(numStr);

// if (!isFinite(num)) {
//   throw new DurationParseError('Invalid number', input, 'INVALID_NUMBER');
// }

// if (!opts.allowNegative && num < 0) {
//   throw new DurationParseError(
//     'Negative values are not allowed',
//     input,
//     'NEGATIVE_NOT_ALLOWED',
//   );
// }

// const unit = this.normalizeUnit(unitStr.toLowerCase(), opts.ambiguousUnit);
// const multiplier = TIME_MULTIPLIERS[unit];
// const result = num * multiplier;

// // **ENHANCEMENT**: Boundary case handling for safe integers.
// if (Math.abs(result) > Number.MAX_SAFE_INTEGER) {
//   throw new DurationParseError(
//     'Value exceeds safe integer limit',
//     input,
//     'VALUE_TOO_LARGE',
//   );
// }

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

// const match = component.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
// if (!match) {
//   throw new DurationParseError(
//     `Invalid duration format: "${component}"`,
//     input,
//     'INVALID_FORMAT',
//     [
//       'Each component should be in the format: <number><unit> (e.g., "1h", "30m")',
//       // 'Examples: "1h 30m", "2d 4h 30m", "1.5h"',
//       'Examples of valid format: "1h", "30m", "1.5d", "2 hours"',
//     ],
//   );
// }

// const [, numStr, unitStr] = match;
// const duration = parseFloat(numStr);

// if (!isFinite(duration))
//   throw new DurationParseError(
//     `Invalid number in component "${component}"`,
//     input,
//     'INVALID_NUMBER',
//   );

// // Track if we have any negative values
// // hasNegativeComponent = num < 0;
// if (duration < 0) {
//   if (!opts.allowNegative) {
//     throw new DurationParseError(
//       'Negative values are not allowed',
//       input,
//       'NEGATIVE_NOT_ALLOWED',
//     );
//   }
//   // Only allow negative in the first component for compound durations
//   if (i > 0) {
//     throw new DurationParseError(
//       'Negative values only allowed on first component',
//       input,
//       'INVALID_NEGATIVE_POSITION',
//     );
//   }
// }

// const unit = this.normalizeUnit(
//   unitStr.toLowerCase(),
//   opts.ambiguousUnit,
// );

// // Check for duplicate units
// if (usedUnits.has(unit)) {
//   throw new DurationParseError(
//     `Duplicate unit "${unitStr}" in compound duration`,
//     input,
//     'DUPLICATE_UNIT',
//     [
//       'Each unit should appear only once',
//       'Example: "1h 30m" not "1h 2h"',
//     ],
//   );
// }

// const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-zA-Z]+)$/);
// if (!match) {
//   throw new DurationParseError(
//     'Invalid duration format',
//     input,
//     'INVALID_FORMAT',
//     ['Examples of valid format: "1h", "30m", "1.5d", "2 hours"'],
//   );
// }

// const [, numStr, unitStr] = match;
// const duration = parseFloat(numStr);

// if (!isFinite(duration)) {
//   throw new DurationParseError('Invalid number', input, 'INVALID_NUMBER');
// }

// if (!opts.allowNegative && duration < 0) {
//   throw new DurationParseError(
//     'Negative values are not allowed',
//     input,
//     'NEGATIVE_NOT_ALLOWED',
//   );
// }

// const unit = this.normalizeUnit(unitStr.toLowerCase(), opts.ambiguousUnit);
// const multiplier = TIME_MULTIPLIERS[unit];
// const milliseconds = duration * multiplier;

// // Boundary case handling for safe integers.
// if (Math.abs(milliseconds) > Number.MAX_SAFE_INTEGER) {
//   throw new DurationParseError(
//     'Value exceeds safe integer limit',
//     input,
//     'VALUE_TOO_LARGE',
//   );
// }

// Handle compound durations (e.g., "1h 30m", "2d 4h 30m") - return array of components
// const components = trimmed.split(/\s+/).filter((c) => c.length > 0); // Filter out empty strings
// if (components.length > 1) {
//   const results: ParseResult[] = [];
//   let totalMilliseconds = 0;
//   const usedUnits = new Set<UnitTime>();

//   for (let i = 0; i < components.length; i++) {
//     const component = components[i];

//     // Skip empty components
//     if (!component) continue;

//     // Parse each component individually here.
//     const data = this.parseComponent(component, opts, i, usedUnits);
//     usedUnits.add(data.unit);
//     results.push(data);
//     totalMilliseconds += data.milliseconds;
//   }

//   return { totalMilliseconds, data: results };
// }

/**
 * Format milliseconds back to human-readable string
 */
export function format(ms: number, options?: FormatOptions): string {
  const opts = {
    long: false,
    precision: 0,
    preferredUnits: [],
    ...options,
  };

  if (typeof ms !== 'number' || !isFinite(ms)) {
    throw new Error('Value must be a finite number');
  }

  const absMs = Math.abs(ms);
  // Explicit handling for zero.
  if (absMs === 0) {
    return opts.long ? '0 milliseconds' : '0ms';
  }

  const sign = ms < 0 ? '-' : '';

  // If preferredUnits are provided, try to use them in order
  if (opts.preferredUnits.length > 0) {
    for (const unit of opts.preferredUnits) {
      const multiplier = TIME_MULTIPLIERS[unit];
      if (absMs >= multiplier && absMs % multiplier === 0) {
        const value = ms / multiplier;
        if (opts.long) {
          const isPlural = Math.abs(value) !== 1;
          const unitName = LONG_NAMES[unit];
          return `${value} ${unitName}${isPlural ? 's' : ''}`;
        } else {
          return `${sign}${Math.abs(value)}${unit}`;
        }
      }
    }
  }

  // Fallback to default behavior, Find the most appropriate unit
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
 * Formats a duration in milliseconds into a string with localized units
 * @param ms Duration in milliseconds
 * @param options Formatting options, including optional locale
 * @returns Formatted duration string
 */
// public formatLocale(
//   ms: number,
//   options?: FormatOptions & { locale?: string },
// ): string {
//   const opts = {
//     long: false,
//     precision: 0,
//     preferredUnits: [],
//     locale: 'en',
//     ...options,
//   };

//   // Load localization based on locale
//   const localization = this.loadLocalization(opts.locale);

//   // Validate input
//   if (typeof ms !== 'number' || !isFinite(ms)) {
//     throw new Error('Value must be a finite number');
//   }

//   const absMs = Math.abs(ms);
//   const sign = ms < 0 ? '-' : '';

//   // Filter units based on preferredUnits if provided
//   // let availableUnits = this.units;
//   // if (opts.preferredUnits.length > 0) {
//   //   availableUnits = this.units.filter(([unit]) =>
//   //     opts.preferredUnits.includes(unit),
//   //   );
//   // }
//   const availableUnits =
//     opts.preferredUnits.length > 0
//       ? this.sortedUnits.filter(([unit]) =>
//           opts.preferredUnits.includes(unit),
//         )
//       : this.sortedUnits;

//   // Find the largest unit that fits
//   let selectedUnit: UnitTime = 'ms';
//   let multiplier = 1;
//   for (const [unit, mult] of availableUnits) {
//     if (absMs >= mult) {
//       selectedUnit = unit;
//       multiplier = mult;
//       break;
//     }
//   }

//   // Calculate the count for the selected unit
//   const count = ms / multiplier;
//   const value =
//     opts.precision > 0
//       ? parseFloat(count.toFixed(opts.precision))
//       : Math.round(count);

//   if (opts.long) {
//     // Determine plural category using Intl.PluralRules
//     const pluralRules = new Intl.PluralRules(localization.locale);
//     const category = pluralRules.select(value) as PluralCategory;

//     // Get unit localization
//     const unitLocalization = localization.units[selectedUnit];
//     if (!unitLocalization) {
//       throw new Error(`No localization for unit: ${selectedUnit}`);
//     }

//     // Select the appropriate localized name, falling back to 'other'
//     const unitName = unitLocalization[category] || unitLocalization['other'];
//     if (!unitName) {
//       throw new Error(
//         `No '${category}' or 'other' form for unit: ${selectedUnit}`,
//       );
//     }

//     return `${value} ${unitName}`;
//   } else {
//     return `${sign}${Math.abs(value)}${selectedUnit}`;
//   }
// }

/* old implementation */
// if (components.length > 1) {
//   const results: ParseResult[] = [];
//   const usedUnits = new Set<UnitTime>();
//   let dominantUnit: UnitTime = 'ms';
//   let maxMultiplier = 0;
//   const totalMilliseconds = components.reduce((sum, component, index) => {
//     // Skip empty components
//     if (!component) return sum;
//     // Parse each component individually here.
//     const data = this.parseComponent(component, opts, index, usedUnits);
//     usedUnits.add(data.unit);
//     results.push(data);
//     // track unit of largest single‑chunk multiplier
//     // const thisUnit = Array.from(usedUnits).pop()!; // last added
//     // if (TIME_MULTIPLIERS[thisUnit] > TIME_MULTIPLIERS[dominantUnit]) {
//     //   dominantUnit = thisUnit;
//     // }
//     // Track unit with largest multiplier for dominant unit
//     const multiplier = TIME_MULTIPLIERS[data.unit];
//     if (multiplier > maxMultiplier) {
//       maxMultiplier = multiplier;
//       dominantUnit = data.unit;
//     }
//     return sum + data.milliseconds;
//   }, 0);
//   return {
//     totalMilliseconds,
//     dominantUnit: {
//       duration: totalMilliseconds / TIME_MULTIPLIERS[dominantUnit],
//       unit: dominantUnit,
//     },
//     data: results,
//   };
// }

// Single component with enhanced regex to handle various formats
// const data = this.parseComponent(trimmed, opts);
// return {
//   totalMilliseconds: data.milliseconds,
//   data: [data],
// };
