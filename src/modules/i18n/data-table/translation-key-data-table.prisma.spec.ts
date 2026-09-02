// src/modules/i18n/data-table/translation-key-data-table.prisma.spec.ts

import { dataTableQuerySchema, resolveDataTableQuery } from 'common/data-table';
import { translationKeyDataTablePolicy } from './translation-key-data-table.policy';
import { translationKeyDataTablePrismaTranslator } from './translation-key-data-table.prisma';

describe('translationKeyDataTablePrismaTranslator', () => {
  it('translates category sorting through the TranslationCategory relation', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'category',
          direction: 'asc',
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolved);

    expect(prismaQuery.orderBy).toEqual([
      {
        translationCategory: {
          name: 'asc',
        },
      },
    ]);
  });

  it('translates category filtering through the TranslationCategory relation', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'category',
          operator: 'contains',
          value: 'auth',
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolved);

    expect(prismaQuery.where).toEqual({
      translationCategory: {
        is: {
          name: {
            contains: 'auth',
            mode: 'insensitive',
          },
        },
      },
    });
  });

  it('translates numeric categoryId filtering without casts', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'categoryId',
          operator: 'equals',
          value: 7,
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolved);

    expect(prismaQuery.where).toEqual({
      categoryId: {
        equals: 7,
      },
    });
  });

  it('translates locale filtering through translations.some', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'locale',
          operator: 'in',
          value: ['en', 'km', 'fr'],
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolved);

    expect(prismaQuery.where).toEqual({
      translations: {
        some: {
          locale: {
            in: ['en', 'km', 'fr'],
            mode: 'insensitive',
          },
        },
      },
    });
  });

  it('searches key, description, category name, and translation values', () => {
    const query = dataTableQuerySchema.parse({
      search: {
        term: 'login',
      },
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolved);

    expect(prismaQuery.where).toEqual({
      OR: [
        {
          key: {
            contains: 'login',
            mode: 'insensitive',
          },
        },

        {
          description: {
            contains: 'login',
            mode: 'insensitive',
          },
        },

        {
          translationCategory: {
            is: {
              name: {
                contains: 'login',
                mode: 'insensitive',
              },
            },
          },
        },

        {
          translations: {
            some: {
              value: {
                contains: 'login',
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    });
  });
});
