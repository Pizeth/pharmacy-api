// src/modules/i18n/types/translation-admin.types.ts

import type { Translation, TranslationCategory } from 'generated/prisma/client';
import type { TranslationKeyDataTableRow } from '../data-table';

/**
 * The admin detail/create/update result deliberately uses the same
 * resource shape as the DataTable row.
 *
 * That gives the frontend one canonical TranslationKey representation.
 */
export type TranslationKeyAdminResult = TranslationKeyDataTableRow;

/**
 * Lightweight category data used by:
 *
 * - create/edit forms
 * - category filter controls
 */
export type TranslationCategoryOption = Pick<
  TranslationCategory,
  'id' | 'name' | 'description'
>;

export type TranslationAdminResult = Translation;

export type DeletedTranslationKeyResult = Pick<
  TranslationKeyDataTableRow,
  'id' | 'key'
>;

export type DeletedTranslationResult = Pick<
  Translation,
  'id' | 'keyId' | 'locale'
>;
