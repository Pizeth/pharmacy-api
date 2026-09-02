// src/modules/i18n/data-table/translation-key-data-table.prisma.ts

import type { Prisma } from 'generated/prisma/client';
import { createDataTablePrismaTranslator } from 'common/data-table';
import type { DataTablePrismaDefaultOrderBy } from 'common/data-table';
import { translationKeyDataTablePolicy } from './translation-key-data-table.policy';

/**
 * ------------------------------------------------------------------
 * Default ordering
 * ------------------------------------------------------------------
 *
 * Translation administration is naturally key-oriented, so the
 * server default is alphabetical.
 *
 * `id` is added as a deterministic tie-breaker even though `key` is
 * unique today.
 *
 * Keeping the tie-breaker makes the pagination contract explicit and
 * resilient if the presentation ordering changes later.
 */
export const TRANSLATION_KEY_DATA_TABLE_DEFAULT_ORDER_BY = [
  {
    key: 'asc',
  },

  {
    id: 'asc',
  },
] as const satisfies DataTablePrismaDefaultOrderBy<Prisma.TranslationKeyOrderByWithRelationInput>;

/**
 * ------------------------------------------------------------------
 * TranslationKey Prisma translator
 * ------------------------------------------------------------------
 *
 * This translator accepts ONLY queries already resolved through:
 *
 *   translationKeyDataTablePolicy
 *
 * No browser field is ever passed directly to Prisma.
 */
export const translationKeyDataTablePrismaTranslator =
  createDataTablePrismaTranslator<
    Prisma.TranslationKeyWhereInput,
    Prisma.TranslationKeyOrderByWithRelationInput
  >()({
    policy: translationKeyDataTablePolicy,

    /**
     * --------------------------------------------------------------
     * Sorting
     * --------------------------------------------------------------
     */
    sorting: {
      id: (direction) => ({
        id: direction,
      }),

      key: (direction) => ({
        key: direction,
      }),

      /**
       * Public:
       *
       *   category
       *
       * Internal:
       *
       *   categoryName
       *
       * Prisma:
       *
       *   translationCategory.name
       */
      categoryName: (direction) => ({
        translationCategory: {
          name: direction,
        },
      }),

      createdAt: (direction) => ({
        createdAt: direction,
      }),

      updatedAt: (direction) => ({
        updatedAt: direction,
      }),
    },

    /**
     * --------------------------------------------------------------
     * Filtering
     * --------------------------------------------------------------
     */
    filtering: {
      id: {
        /**
         * value: number
         *
         * The type comes from our resource-specific Zod parser.
         */
        equals: (value) => ({
          id: {
            equals: value,
          },
        }),

        /**
         * value: number[]
         */
        in: (value) => ({
          id: {
            in: [...value],
          },
        }),
      },

      key: {
        /**
         * value: string
         */
        equals: (value) => ({
          key: {
            equals: value,
            mode: 'insensitive',
          },
        }),

        contains: (value) => ({
          key: {
            contains: value,
            mode: 'insensitive',
          },
        }),
      },

      description: {
        equals: (value) => ({
          description: {
            equals: value,
            mode: 'insensitive',
          },
        }),

        contains: (value) => ({
          description: {
            contains: value,
            mode: 'insensitive',
          },
        }),
      },

      categoryId: {
        /**
         * value: number
         */
        equals: (value) => ({
          categoryId: {
            equals: value,
          },
        }),

        /**
         * value: number[]
         */
        in: (value) => ({
          categoryId: {
            in: [...value],
          },
        }),
      },

      categoryName: {
        /**
         * Relation-aware filter.
         *
         * The public browser query never sees:
         *
         *   translationCategory
         */
        equals: (value) => ({
          translationCategory: {
            is: {
              name: {
                equals: value,
                mode: 'insensitive',
              },
            },
          },
        }),

        contains: (value) => ({
          translationCategory: {
            is: {
              name: {
                contains: value,
                mode: 'insensitive',
              },
            },
          },
        }),
      },

      translationLocale: {
        /**
         * TranslationKey has-many Translation.
         *
         * Public:
         *
         *   locale = "km"
         *
         * becomes:
         *
         *   translations.some.locale = "km"
         */
        equals: (value) => ({
          translations: {
            some: {
              locale: {
                equals: value,
                mode: 'insensitive',
              },
            },
          },
        }),

        in: (value) => ({
          translations: {
            some: {
              locale: {
                in: [...value],
                mode: 'insensitive',
              },
            },
          },
        }),
      },
    },

    /**
     * --------------------------------------------------------------
     * Global search
     * --------------------------------------------------------------
     *
     * Each target produces one independent Prisma where fragment.
     *
     * The generic translator combines them with OR.
     */
    search: {
      key: (term) => ({
        key: {
          contains: term,
          mode: 'insensitive',
        },
      }),

      description: (term) => ({
        description: {
          contains: term,
          mode: 'insensitive',
        },
      }),

      categoryName: (term) => ({
        translationCategory: {
          is: {
            name: {
              contains: term,
              mode: 'insensitive',
            },
          },
        },
      }),

      /**
       * Search translation values across every locale.
       *
       * Example search:
       *
       *   "Login"
       *
       * can match:
       *
       *   translations[].value
       */
      translationValue: (term) => ({
        translations: {
          some: {
            value: {
              contains: term,
              mode: 'insensitive',
            },
          },
        },
      }),
    },

    /**
     * --------------------------------------------------------------
     * Logical composition
     * --------------------------------------------------------------
     */
    where: {
      and: (clauses) => ({
        AND: [...clauses],
      }),

      or: (clauses) => ({
        OR: [...clauses],
      }),
    },
  });
