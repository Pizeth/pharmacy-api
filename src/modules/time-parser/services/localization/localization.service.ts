// src/utils/localization.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LocalizationConfig } from 'src/types/time';

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);
  private readonly cache = new Map<string, LocalizationConfig>();
  private readonly pluralCache = new Map<string, Intl.PluralRules>();

  constructor(
    private readonly localesPath = path.join(process.cwd(), 'src/i18n'),
    private readonly defaultConfig: LocalizationConfig,
    private readonly maxCache = 100,
  ) {
    this.cache.set(defaultConfig.locale, defaultConfig);
  }

  /** Get or load locale JSON, falling back to default. */
  get(locale: string): LocalizationConfig {
    if (this.cache.has(locale)) {
      return this.cache.get(locale)!;
    }
    const file = path.resolve(this.localesPath, locale, `${locale}.json`);
    if (!file.startsWith(this.localesPath)) {
      throw new Error(`Invalid locale path: ${locale}`);
    }
    try {
      const data = fs.readFileSync(file, 'utf8');
      const cfg = JSON.parse(data) as LocalizationConfig;
      const merged: LocalizationConfig = {
        ...this.defaultConfig,
        ...cfg,
        units: { ...this.defaultConfig.units, ...cfg.units },
      };
      this.evictIfNeeded();
      this.cache.set(locale, merged);
      return merged;
    } catch (err) {
      this.logger.warn(`Locale load failed for "${locale}"`, err);
      return this.defaultConfig;
    }
  }

  /** Intl.PluralRules with caching. */
  pluralRules(locale: string): Intl.PluralRules {
    if (!this.pluralCache.has(locale)) {
      try {
        this.pluralCache.set(locale, new Intl.PluralRules(locale));
      } catch {
        this.pluralCache.set(
          locale,
          new Intl.PluralRules(this.defaultConfig.locale),
        );
      }
    }
    return this.pluralCache.get(locale)!;
  }

  /** LRU eviction. */
  private evictIfNeeded() {
    if (this.cache.size >= this.maxCache) {
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
  }
}
