// src/modules/i18n/schemas/translation-admin.schema.ts

import { z } from 'zod';

/**
 * ------------------------------------------------------------------
 * TranslationKey
 * ------------------------------------------------------------------
 */

export const translationKeyNameSchema = z
  .string()
  .trim()
  .min(1, {
    error: 'Translation key is required.',
  })
  .max(100, {
    error: 'Translation key must not exceed 100 characters.',
  });

/**
 * Nullable because TranslationKey.description is nullable in Prisma.
 *
 * Semantics:
 *
 *   omitted  → don't provide/change description
 *   null     → explicitly clear description
 *   string   → set description
 */
export const translationKeyDescriptionSchema = z
  .string()
  .trim()
  .max(255, {
    error: 'Description must not exceed 255 characters.',
  })
  .nullable();

export const translationCategoryIdSchema = z
  .number()
  .int({
    error: 'Category ID must be an integer.',
  })
  .positive({
    error: 'Category ID must be greater than zero.',
  });

/**
 * POST /keys
 *
 * Body values come from JSON, so categoryId deliberately DOES NOT
 * use z.coerce.number().
 *
 * The client must send:
 *
 *   "categoryId": 1
 *
 * not:
 *
 *   "categoryId": "1"
 */
export const createTranslationKeySchema = z.strictObject({
  key: translationKeyNameSchema,
  description: translationKeyDescriptionSchema.optional(),
  categoryId: translationCategoryIdSchema,
});

export type CreateTranslationKeyInput = z.output<
  typeof createTranslationKeySchema
>;

/**
 * PATCH /keys/:id
 */
export const updateTranslationKeySchema = z
  .strictObject({
    key: translationKeyNameSchema.optional(),
    description: translationKeyDescriptionSchema.optional(),
    categoryId: translationCategoryIdSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    error: 'At least one translation-key field must be provided.',
  });

export type UpdateTranslationKeyInput = z.output<
  typeof updateTranslationKeySchema
>;

/**
 * ------------------------------------------------------------------
 * Translation locale
 * ------------------------------------------------------------------
 *
 * Supports practical BCP-47-like forms:
 *
 *   en
 *   km
 *   fr
 *   en-US
 *   zh-Hans
 */
export const translationLocaleSchema = z
  .string()
  .min(2, {
    error: 'Locale is required.',
  })
  .max(35, {
    error: 'Locale must not exceed 35 characters.',
  })
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/, {
    error: 'Locale has an invalid format.',
  });

export type TranslationLocale = z.output<typeof translationLocaleSchema>;

/**
 * Translation.value is PostgreSQL Text.
 *
 * Do NOT trim the returned value.
 *
 * Leading/trailing whitespace may eventually be meaningful in
 * translated content. We only reject values containing nothing but
 * whitespace.
 */
export const translationValueSchema = z
  .string()
  .min(1, {
    error: 'Translation value is required.',
  })
  .max(10_000, {
    error: 'Translation value must not exceed 10,000 characters.',
  })
  .refine((value) => value.trim().length > 0, {
    error: 'Translation value must not contain only whitespace.',
  });

/**
 * POST /keys/:keyId/translations
 */
export const createTranslationSchema = z.strictObject({
  locale: translationLocaleSchema,
  value: translationValueSchema,
});

export type CreateTranslationInput = z.output<typeof createTranslationSchema>;

/**
 * PATCH /keys/:keyId/translations/:locale
 */
export const updateTranslationSchema = z.strictObject({
  value: translationValueSchema,
});

export type UpdateTranslationInput = z.output<typeof updateTranslationSchema>;

/**
 * ------------------------------------------------------------------
 * Route parameters
 * ------------------------------------------------------------------
 *
 * Route params arrive from HTTP as strings, so coercion IS correct
 * here.
 */
export const positiveIntegerParamSchema = z.coerce
  .number()
  .int({
    error: 'ID must be an integer.',
  })
  .positive({
    error: 'ID must be greater than zero.',
  });

export type PositiveIntegerParam = z.output<typeof positiveIntegerParamSchema>;
