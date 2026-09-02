// src/modules/prisma/seeders/schemas/translation-seed.schema.ts

import * as z from 'zod';

/**
 * ------------------------------------------------------------------
 * Shared scalar schemas
 * ------------------------------------------------------------------
 */

/**
 * TranslationCategory.name.
 *
 * Category names are portable seed identifiers, so seed files use
 * these names instead of database-generated category IDs.
 */
export const translationSeedCategoryNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Translation category name is required.' })
  .max(100, {
    error: 'Translation category name must not exceed 100 characters.',
  });

/**
 * Optional description shared by categories and translation keys.
 */
export const translationSeedDescriptionSchema = z
  .string()
  .trim()
  .max(255, { error: 'Description must not exceed 255 characters.' })
  .optional();

/**
 * Locale stored in Translation.locale.
 *
 * Examples:
 *
 *   en
 *   km
 *   fr
 *   en-US
 *   zh-Hans
 *
 * We deliberately validate a practical locale shape rather than
 * trying to implement the complete BCP-47 grammar here.
 *
 * Notice there is NO `.trim()` on this schema.
 *
 * This schema is used as a z.record() KEY schema. We want malformed
 * keys such as:
 *
 *   " en "
 *
 * to fail rather than silently transform an object property name.
 */
export const translationSeedLocaleSchema = z
  .string()
  .min(2, { error: 'Locale is required.' })
  .max(35, { error: 'Locale must not exceed 35 characters.' })
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/, {
    error: 'Locale has an invalid format.',
  });

/**
 * Translation.value is PostgreSQL Text.
 *
 * We still set a generous seed-file safety limit so an accidentally
 * enormous value is caught during initialization.
 */
export const translationSeedValueSchema = z
  .string()
  .trim()
  .min(1, { error: 'Translation value must not be empty.' })
  .max(10_000, { error: 'Translation value is unexpectedly large.' });

/**
 * ------------------------------------------------------------------
 * Translation category
 * ------------------------------------------------------------------
 *
 * z.strictObject() is the Zod 4-native strict-object API.
 *
 * Unknown properties in translations.json are rejected instead of
 * silently being stripped.
 */
export const translationSeedCategorySchema = z.strictObject({
  name: translationSeedCategoryNameSchema,
  description: translationSeedDescriptionSchema,
});

/**
 * ------------------------------------------------------------------
 * Translation values by locale
 * ------------------------------------------------------------------
 *
 * Zod 4 requires the key schema AND value schema for z.record():
 *
 *   z.record(keySchema, valueSchema)
 *
 * Produces:
 *
 *   Record<string, string>
 *
 * after successful parsing.
 */
export const translationSeedTranslationsSchema = z
  .record(translationSeedLocaleSchema, translationSeedValueSchema)
  .refine((translations) => Object.keys(translations).length > 0, {
    error: 'Every translation key must define at least one locale.',
  });

/**
 * ------------------------------------------------------------------
 * Translation key
 * ------------------------------------------------------------------
 *
 * We use flat snake_case keys for the initial baseline.
 *
 * That avoids accidentally coupling the database seed to i18next's
 * dot/keySeparator semantics.
 *
 * Example:
 *
 *   auth_login
 *   validation_required
 *   navigation_dashboard
 */
export const translationSeedKeySchema = z.strictObject({
  /**
   * Initial seed convention:
   *
   *   common_save
   *   auth_login
   *   validation_required
   *
   * We deliberately avoid committing the database seed to i18next
   * dotted-key semantics until the frontend i18next configuration is
   * finalized.
   */
  key: z
    .string()
    .trim()
    .min(1, { error: 'Translation key is required.' })
    .max(100, { error: 'Translation key must not exceed 100 characters.' })
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, {
      error: 'Translation seed keys must use lowercase snake_case.',
    }),

  description: translationSeedDescriptionSchema,

  /**
   * IMPORTANT:
   *
   * This is TranslationCategory.name.
   *
   * It is intentionally NOT categoryId because autoincremented IDs
   * are not portable across databases/environments.
   */
  category: translationSeedCategoryNameSchema,

  /**
   * Example:
   *
   * {
   *   "en": "Login",
   *   "km": "..."
   * }
   */
  translations: translationSeedTranslationsSchema,
});

/**
 * ------------------------------------------------------------------
 * Base seed document
 * ------------------------------------------------------------------
 */
const translationSeedDataBaseSchema = z.strictObject({
  categories: z.array(translationSeedCategorySchema).min(1, {
    error: 'At least one translation category is required.',
  }),

  keys: z.array(translationSeedKeySchema).min(1, {
    error: 'At least one translation key is required.',
  }),
});

/**
 * ------------------------------------------------------------------
 * Complete translation seed document
 * ------------------------------------------------------------------
 *
 * Zod 4's .check() gives us access to:
 *
 *   context.value
 *   context.issues
 *
 * and allows multiple structural/cross-reference errors to be
 * reported in one validation pass.
 */
export const translationSeedDataSchema =
  translationSeedDataBaseSchema.superRefine((seedData, context) => {
    /**
     * ----------------------------------------------------------
     * Validate category uniqueness
     * ----------------------------------------------------------
     */
    const categoryNames = new Set<string>();

    seedData.categories.forEach((category, index) => {
      if (categoryNames.has(category.name)) {
        context.addIssue({
          code: 'custom',
          path: ['categories', index, 'name'],
          message: `Duplicate translation category "${category.name}".`,
        });

        return;
      }

      categoryNames.add(category.name);
    });

    /**
     * ----------------------------------------------------------
     * Validate translation-key uniqueness
     * ----------------------------------------------------------
     */
    const translationKeys = new Set<string>();

    seedData.keys.forEach((translationKey, index) => {
      if (translationKeys.has(translationKey.key)) {
        context.addIssue({
          code: 'custom',
          path: ['keys', index, 'key'],
          message: `Duplicate translation key "${translationKey.key}".`,
        });
      } else {
        translationKeys.add(translationKey.key);
      }

      /**
       * ------------------------------------------------------
       * Validate TranslationKey -> TranslationCategory
       * references
       * ------------------------------------------------------
       *
       * Every:
       *
       *   key.category
       *
       * must correspond to one category defined by:
       *
       *   categories[].name
       */
      if (!categoryNames.has(translationKey.category)) {
        context.addIssue({
          code: 'custom',
          path: ['keys', index, 'category'],
          message: `Translation key "${translationKey.key}" references unknown category "${translationKey.category}".`,
        });
      }
    });
  });

/**
 * ------------------------------------------------------------------
 * Inferred output types
 * ------------------------------------------------------------------
 *
 * We use z.output rather than manually duplicating the object shapes.
 */
export type TranslationSeedData = z.output<typeof translationSeedDataSchema>;

export type TranslationSeedCategory = z.output<
  typeof translationSeedCategorySchema
>;

export type TranslationSeedKey = z.output<typeof translationSeedKeySchema>;

/**
 * ------------------------------------------------------------------
 * Canonical parser
 * ------------------------------------------------------------------
 *
 * Keep Zod parsing at the validation boundary rather than leaking
 * parser mechanics into TranslationSeeder.
 *
 * `input: unknown` is intentional:
 *
 * imported JSON is external initialization data and should be treated
 * as untrusted until this function succeeds.
 *
 * Zod 4 exposes the top-level parse(schema, input) API as well as the
 * classic schema.parse(input) API. Using the top-level function here
 * also avoids the problematic unresolved member-call diagnostic that
 * you are currently seeing.
 */
export function parseTranslationSeedData(input: unknown): TranslationSeedData {
  return z.parse(translationSeedDataSchema, input);
}
