// src/modules/i18n/controllers/i18n.controller.ts

import { Controller, Get, Param, VERSION_NEUTRAL } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { translationLocaleSchema } from '../schemas';
import type { TranslationLocale } from '../schemas';
import { I18nService } from '../services/i18n.service';

/**
 * Public runtime translation controller.
 *
 * This controller deliberately contains NO administrative operations.
 *
 * The endpoint is consumed by the application's runtime i18n loader.
 */
@Controller({ path: 'i18n', version: VERSION_NEUTRAL })
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  /**
   * Fetch the runtime dictionary for one locale.
   * 🌐 Public — this is what i18next-http-backend fetches on the frontend
   *
   * Example:
   *
   * GET /api/i18n/en
   * GET /api/i18n/km
   */
  @AllowAnonymous()
  @Get(':locale')
  getDictionary(
    @Param('locale', {
      schema: translationLocaleSchema,
    })
    locale: TranslationLocale,
  ): Promise<Record<string, string> | null> {
    return this.i18nService.getDictionary(locale);
  }
}
