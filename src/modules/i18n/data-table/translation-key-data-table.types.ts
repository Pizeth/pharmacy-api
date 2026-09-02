// src/modules/i18n/data-table/translation-key-data-table.types.ts

import type { Prisma } from 'generated/prisma/client';
import type { PaginatedDataResult } from 'types/types';
import { TRANSLATION_KEY_DATA_TABLE_SELECT } from './translation-key-data-table.select';

/**
 * Exact row shape produced by:
 *
 * prisma.translationKey.findMany({
 *   select: TRANSLATION_KEY_DATA_TABLE_SELECT,
 * })
 *
 * This automatically stays synchronized with generated Prisma types.
 */
export type TranslationKeyDataTableRow = Prisma.TranslationKeyGetPayload<{
  select: typeof TRANSLATION_KEY_DATA_TABLE_SELECT;
}>;

/**
 * Complete paginated DataTable result.
 */
export type TranslationKeyDataTableResult =
  PaginatedDataResult<TranslationKeyDataTableRow>;
