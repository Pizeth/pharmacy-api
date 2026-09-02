// src/modules/i18n/data-table/translation-key-data-table.select.ts

import type { Prisma } from 'generated/prisma/client';

/**
 * Canonical TranslationKey selection used by the admin DataTable.
 *
 * Return:
 *
 *   TranslationKey
 *     ├── scalar metadata
 *     ├── category
 *     └── translations[]
 *
 * The frontend can pivot `translations` into dynamic locale columns:
 *
 *   key | category | en | km | fr | ...
 */
export const TRANSLATION_KEY_DATA_TABLE_SELECT = {
  id: true,
  key: true,
  description: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  translationCategory: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  translations: {
    /**
     * Stable ordering makes response serialization deterministic and
     * makes client-side locale-column generation simpler.
     */
    orderBy: {
      locale: 'asc',
    },
    select: {
      id: true,
      locale: true,
      value: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const satisfies Prisma.TranslationKeySelect;
