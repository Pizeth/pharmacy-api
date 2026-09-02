// src/modules/i18n/data-table/translation-key-data-table.policy.ts

import { z } from 'zod';
import {
  createDataTableQueryPolicy,
  DATA_TABLE_MAX_FILTER_STRING_LENGTH,
} from 'common/data-table';

/**
 * ------------------------------------------------------------------
 * Resource-specific filter value schemas
 * ------------------------------------------------------------------
 *
 * The generic DataTable transport intentionally understands only:
 *
 *   string
 *   number
 *   boolean
 *
 * Resource policy is where those generic values become meaningful.
 */

/**
 * Prisma auto-increment IDs are positive integers.
 */
const translationKeyIdSchema = z.number().int().positive();

/**
 * General bounded text used by TranslationKey text filters.
 *
 * The outer DataTable transport already imposes a maximum string
 * length, but keeping the resource parser explicit gives us:
 *
 *   - type narrowing
 *   - trimming
 *   - resource-level semantics
 */
const translationKeyFilterTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(DATA_TABLE_MAX_FILTER_STRING_LENGTH);

/**
 * Locale identifiers are stored as strings:
 *
 *   en
 *   km
 *   fr
 *   en-US
 *
 * We deliberately do not attempt to fully validate BCP-47 here.
 *
 * This layer is responsible for DataTable query semantics, not the
 * application's locale registry.
 */
const translationLocaleSchema = z.string().trim().min(1).max(35);

const translationKeyIdListSchema = z.array(translationKeyIdSchema).min(1);

const translationLocaleListSchema = z.array(translationLocaleSchema).min(1);

/**
 * ------------------------------------------------------------------
 * TranslationKey DataTable resource policy
 * ------------------------------------------------------------------
 *
 * Public fields are frontend/API concepts.
 *
 * Targets are trusted INTERNAL identifiers consumed by the Prisma
 * translator.
 *
 * They are deliberately allowed to differ.
 *
 * Example:
 *
 *   browser:
 *     category
 *
 *          ↓
 *
 *   policy target:
 *     categoryName
 *
 *          ↓
 *
 *   Prisma translator:
 *     translationCategory.name
 */
export const translationKeyDataTablePolicy = createDataTableQueryPolicy({
  /**
   * --------------------------------------------------------------
   * Sorting
   * --------------------------------------------------------------
   */
  sorting: {
    id: {
      target: 'id',
    },
    key: {
      target: 'key',
    },

    /**
     * Public API exposes this simply as:
     *
     *   category
     *
     * The browser never needs to know the Prisma relation name.
     */
    category: {
      target: 'categoryName',
    },
    createdAt: {
      target: 'createdAt',
    },
    updatedAt: {
      target: 'updatedAt',
    },
  },

  /**
   * --------------------------------------------------------------
   * Filtering
   * --------------------------------------------------------------
   */
  filtering: {
    id: {
      target: 'id',
      operators: ['equals', 'in'],
      values: {
        equals: translationKeyIdSchema,
        in: translationKeyIdListSchema,
      },
    },
    key: {
      target: 'key',
      operators: ['equals', 'contains'],
      values: {
        equals: translationKeyFilterTextSchema,
        contains: translationKeyFilterTextSchema,
      },
    },
    description: {
      target: 'description',
      operators: ['equals', 'contains'],
      values: {
        equals: translationKeyFilterTextSchema,
        contains: translationKeyFilterTextSchema,
      },
    },
    categoryId: {
      target: 'categoryId',
      operators: ['equals', 'in'],
      values: {
        equals: translationKeyIdSchema,
        in: translationKeyIdListSchema,
      },
    },
    category: {
      target: 'categoryName',
      operators: ['equals', 'contains'],
      values: {
        equals: translationKeyFilterTextSchema,
        contains: translationKeyFilterTextSchema,
      },
    },

    /**
     * TranslationKey does not have a locale scalar itself.
     *
     * This public field means:
     *
     *   "Translation keys having at least one Translation whose
     *    locale matches this value."
     *
     * Prisma relation details remain hidden.
     */
    locale: {
      target: 'translationLocale',
      operators: ['equals', 'in'],
      values: {
        equals: translationLocaleSchema,
        in: translationLocaleListSchema,
      },
    },
  },

  /**
   * --------------------------------------------------------------
   * Global search
   * --------------------------------------------------------------
   *
   * Search fields are entirely server-owned.
   *
   * The browser sends only:
   *
   *   {
   *     search: {
   *       term: "login"
   *     }
   *   }
   *
   * It never chooses these targets.
   */
  search: {
    targets: ['key', 'description', 'categoryName', 'translationValue'],
  },
});

/**
 * Useful when another resource-specific file needs the exact policy
 * type without repeating typeof everywhere.
 */
export type TranslationKeyDataTablePolicy =
  typeof translationKeyDataTablePolicy;
