// src/modules/prisma/seeders/translation.seeder.ts

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import type { Prisma } from 'generated/prisma/client';

import { AppError } from 'exceptions/app.exception';

import data from '../data/translations.json';

import { PrismaService } from '../services/prisma.service';

import { parseTranslationSeedData } from './schemas/translation-seed.schema';

import type { TranslationSeedData } from './schemas/translation-seed.schema';

/**
 * Summary returned by TranslationSeeder.
 *
 * This gives the parent Seeder useful information without returning
 * complete database rows unnecessarily.
 */
export interface TranslationSeedResult {
  readonly categories: number;
  readonly keys: number;
  readonly translations: number;
}

/**
 * Seeds the complete application translation baseline:
 *
 *   TranslationCategory
 *       ↓
 *   TranslationKey
 *       ↓
 *   Translation
 *
 * All writes use unique constraints and upserts, making this seeder
 * idempotent.
 *
 * Running the translation seed repeatedly should therefore update
 * existing seeded values rather than create duplicates.
 */
@Injectable()
export class TranslationSeeder {
  private readonly context = TranslationSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
  }

  /**
   * Seed translation categories, translation keys and locale values.
   *
   * When `tx` is supplied, all operations participate in the parent
   * transaction created by Seeder.
   *
   * When omitted, this seeder operates directly through PrismaService.
   *
   * Seed:
   *
   *   TranslationCategory
   *       ↓
   *   TranslationKey
   *       ↓
   *   Translation
   *
   * All operations are idempotent.
   *
   * Re-running this seeder updates descriptions/categories/translation
   * values without creating duplicate rows.
   */
  async seed(tx?: Prisma.TransactionClient): Promise<TranslationSeedResult> {
    this.logger.log(
      '🌐 Seeding translation categories, keys, and locale values...',
    );

    const prismaClient = tx ?? this.prisma;

    try {
      /**
       * Validate our imported JSON before touching the database.
       */
      const seedData = this.getSeedData();

      /**
       * ------------------------------------------------------------
       * Phase 1 — Translation categories
       * ------------------------------------------------------------
       *
       * Maintain a local mapping:
       *
       *   category name
       *       ↓
       *   actual database ID
       *
       * Keep actual database IDs completely out of the seed JSON.
       * The JSON therefore remains portable across all environments
       * and never contains generated database IDs.
       */
      const categoryIds = new Map<string, number>();

      for (const categoryData of seedData.categories) {
        const category = await prismaClient.translationCategory.upsert({
          /**
           * TranslationCategory.name is unique.
           */
          where: {
            name: categoryData.name,
          },

          /**
           * Unlike static role initialization, translation
           * metadata should remain synchronized with the seed
           * source.
           */
          update: {
            description: categoryData.description ?? null,
          },

          create: {
            name: categoryData.name,
            description: categoryData.description ?? null,
          },
        });

        categoryIds.set(category.name, category.id);
      }

      this.logger.log(
        `✅ Translation categories verified: ${categoryIds.size}`,
      );

      /**
       * ------------------------------------------------------------
       * Phase 2 — Translation keys
       * ------------------------------------------------------------
       */
      let translationCount = 0;

      for (const keyData of seedData.keys) {
        const categoryId = categoryIds.get(keyData.category);

        /**
         * The Zod root schema already guarantees that key.category
         * references a declared category.
         *
         * Keep this runtime guard anyway because this is also a
         * database-initialization boundary.
         */
        if (categoryId === undefined) {
          throw new Error(
            `Translation category "${keyData.category}" was not resolved for translation key "${keyData.key}".`,
          );
        }

        const translationKey = await prismaClient.translationKey.upsert({
          /**
           * TranslationKey.key is globally unique.
           */
          where: {
            key: keyData.key,
          },

          /**
           * Seed changes are intentionally propagated.
           *
           * Unlike RoleSeeder's update: {}, translation seed
           * descriptions/category assignments should stay in
           * sync with the source file.
           *
           * Allow edits to translations.json to update existing
           * seed rows.
           */
          update: {
            description: keyData.description ?? null,
            categoryId,
          },

          create: {
            key: keyData.key,
            description: keyData.description ?? null,
            categoryId,
          },
        });

        /**
         * ----------------------------------------------------------
         * Phase 3 — Locale translations
         * ----------------------------------------------------------
         *
         * Prisma schema:
         *
         *   @@unique([keyId, locale])
         *
         * generates:
         *
         *   keyId_locale
         *
         * which gives us the ideal compound upsert key.
         */
        for (const [locale, value] of Object.entries(keyData.translations)) {
          await prismaClient.translation.upsert({
            where: {
              keyId_locale: {
                keyId: translationKey.id,
                locale,
              },
            },

            /**
             * Seed file becomes the baseline source of truth.
             */
            update: {
              value,
            },

            create: {
              keyId: translationKey.id,
              locale,
              value,
            },
          });

          translationCount += 1;
        }
      }

      const result: TranslationSeedResult = {
        categories: categoryIds.size,
        keys: seedData.keys.length,
        translations: translationCount,
      };

      this.logger.log(
        `✅ Translation seed completed: ${result.categories} categories, ${result.keys} keys, ${result.translations} locale values.`,
      );

      return result;
    } catch (error: unknown) {
      this.logger.error('CRITICAL: Translation seed pipeline failed.', error);

      throw new AppError(
        'Failed to seed translation data.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  /**
   * Validate the JSON seed payload before any database operation.
   *
   * Although TypeScript can infer the imported JSON structure, that
   * compile-time shape is not a substitute for runtime validation.
   *
   * The parser establishes the trusted TranslationSeedData boundary.
   */
  private getSeedData(): TranslationSeedData {
    return parseTranslationSeedData(data);
  }
}
