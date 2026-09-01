// src/common/data-table/prisma/create-data-table-prisma-translator.spec.ts

import { dataTableQuerySchema } from '../schemas/data-table-query.schema';
import { createDataTableQueryPolicy } from '../query/create-data-table-query-policy';
import { resolveDataTableQuery } from '../query/resolve-data-table-query';
import { createDataTablePrismaTranslator } from './create-data-table-prisma-translator';

/**
 * ------------------------------------------------------------------
 * Test-only Prisma-like types
 * ------------------------------------------------------------------
 *
 * These intentionally resemble generated Prisma WhereInput and
 * OrderByWithRelationInput shapes without coupling generic DataTable
 * tests to one production model.
 */

type TestScalar = string | number | boolean;

interface TestStringFilter {
  readonly equals?: TestScalar;
  readonly contains?: string;
  readonly in?: readonly TestScalar[];
  readonly mode?: 'insensitive';
}

interface TestNumberFilter {
  readonly equals?: TestScalar;
  readonly gte?: number;
  readonly lte?: number;
}

interface TestBooleanFilter {
  readonly equals?: TestScalar;
}

interface TestWhereInput {
  readonly AND?: readonly TestWhereInput[];
  readonly OR?: readonly TestWhereInput[];
  readonly title?: TestStringFilter;
  readonly description?: TestStringFilter;
  readonly documentNumber?: TestStringFilter;
  readonly status?: TestStringFilter;
  readonly processingDays?: TestNumberFilter;
  readonly isEnabled?: TestBooleanFilter;
}

interface TestOfficeOrderBy {
  readonly name?: 'asc' | 'desc';
}

interface TestOrderByInput {
  readonly title?: 'asc' | 'desc';
  readonly createdAt?: 'asc' | 'desc';
  readonly office?: TestOfficeOrderBy;
}

/**
 * ------------------------------------------------------------------
 * Test resource policy
 * ------------------------------------------------------------------
 */

const testPolicy = createDataTableQueryPolicy({
  sorting: {
    title: {
      target: 'title',
    },

    office: {
      target: 'officeName',
    },

    createdAt: {
      target: 'createdAt',
    },
  },

  filtering: {
    title: {
      target: 'title',
      operators: ['contains', 'equals'],
    },

    status: {
      target: 'status',
      operators: ['equals', 'in'],
    },

    processingDays: {
      target: 'processingDays',
      operators: ['equals', 'gte', 'lte'],
    },

    enabled: {
      target: 'isEnabled',
      operators: ['equals'],
    },
  },

  search: {
    targets: ['title', 'description', 'documentNumber'],
  },
});

/**
 * ------------------------------------------------------------------
 * Test Prisma translator
 * ------------------------------------------------------------------
 */

const testTranslator = createDataTablePrismaTranslator<
  TestWhereInput,
  TestOrderByInput
>()({
  policy: testPolicy,

  sorting: {
    title: (direction) => ({
      title: direction,
    }),

    officeName: (direction) => ({
      office: {
        name: direction,
      },
    }),

    createdAt: (direction) => ({
      createdAt: direction,
    }),
  },

  filtering: {
    title: {
      contains: (value) => ({
        title: {
          contains: value,
          mode: 'insensitive',
        },
      }),

      equals: (value) => ({
        title: {
          equals: value,
        },
      }),
    },

    status: {
      equals: (value) => ({
        status: {
          equals: value,
        },
      }),

      in: (value) => ({
        status: {
          in: value,
        },
      }),
    },

    processingDays: {
      equals: (value) => ({
        processingDays: {
          equals: value,
        },
      }),

      gte: (value) => ({
        processingDays: {
          gte: value,
        },
      }),

      lte: (value) => ({
        processingDays: {
          lte: value,
        },
      }),
    },

    isEnabled: {
      equals: (value) => ({
        isEnabled: {
          equals: value,
        },
      }),
    },
  },

  search: {
    title: (term) => ({
      title: {
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

    documentNumber: (term) => ({
      documentNumber: {
        contains: term,
        mode: 'insensitive',
      },
    }),
  },

  where: {
    and: (clauses) => ({
      AND: [...clauses],
    }),

    or: (clauses) => ({
      OR: [...clauses],
    }),
  },
});

describe('createDataTablePrismaTranslator', () => {
  it('translates pagination into Prisma skip and take', () => {
    const query = dataTableQuerySchema.parse({
      page: 3,
      pageSize: 25,
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.skip).toBe(50);

    expect(result.take).toBe(25);
  });

  it('omits where and orderBy for an otherwise empty query', () => {
    const query = dataTableQuerySchema.parse({
      page: 1,
      pageSize: 25,
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result).toEqual({
      skip: 0,
      take: 25,
    });

    expect(Object.prototype.hasOwnProperty.call(result, 'where')).toBe(false);

    expect(Object.prototype.hasOwnProperty.call(result, 'orderBy')).toBe(false);
  });

  it('preserves multi-column sorting precedence', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'office',
          direction: 'asc',
        },

        {
          field: 'createdAt',
          direction: 'desc',
        },
      ],
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.orderBy).toEqual([
      {
        office: {
          name: 'asc',
        },
      },

      {
        createdAt: 'desc',
      },
    ]);
  });

  it('translates one filter without unnecessary AND wrapping', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'ACTIVE',
        },
      ],
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.where).toEqual({
      status: {
        equals: 'ACTIVE',
      },
    });
  });

  it('ANDs multiple column filters', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'ACTIVE',
        },

        {
          field: 'processingDays',
          operator: 'gte',
          value: 5,
        },

        {
          field: 'processingDays',
          operator: 'lte',
          value: 30,
        },
      ],
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.where).toEqual({
      AND: [
        {
          status: {
            equals: 'ACTIVE',
          },
        },

        {
          processingDays: {
            gte: 5,
          },
        },

        {
          processingDays: {
            lte: 30,
          },
        },
      ],
    });
  });

  it('translates an in filter', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'status',
          operator: 'in',
          value: ['ACTIVE', 'INACTIVE'],
        },
      ],
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.where).toEqual({
      status: {
        in: ['ACTIVE', 'INACTIVE'],
      },
    });
  });

  it('ORs all server-owned global-search targets', () => {
    const query = dataTableQuerySchema.parse({
      search: {
        term: 'aspirin',
      },
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.where).toEqual({
      OR: [
        {
          title: {
            contains: 'aspirin',
            mode: 'insensitive',
          },
        },

        {
          description: {
            contains: 'aspirin',
            mode: 'insensitive',
          },
        },

        {
          documentNumber: {
            contains: 'aspirin',
            mode: 'insensitive',
          },
        },
      ],
    });
  });

  it('ANDs column filters with the global-search OR group', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'ACTIVE',
        },

        {
          field: 'enabled',
          operator: 'equals',
          value: true,
        },
      ],

      search: {
        term: 'aspirin',
      },
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.where).toEqual({
      AND: [
        {
          status: {
            equals: 'ACTIVE',
          },
        },

        {
          isEnabled: {
            equals: true,
          },
        },

        {
          OR: [
            {
              title: {
                contains: 'aspirin',
                mode: 'insensitive',
              },
            },

            {
              description: {
                contains: 'aspirin',
                mode: 'insensitive',
              },
            },

            {
              documentNumber: {
                contains: 'aspirin',
                mode: 'insensitive',
              },
            },
          ],
        },
      ],
    });
  });

  it('translates sorting, filtering, searching, and pagination together', () => {
    const query = dataTableQuerySchema.parse({
      page: 4,
      pageSize: 50,
      sorting: [
        {
          field: 'office',
          direction: 'asc',
        },

        {
          field: 'createdAt',
          direction: 'desc',
        },
      ],

      filters: [
        {
          field: 'status',
          operator: 'in',
          value: ['ACTIVE', 'PENDING'],
        },

        {
          field: 'processingDays',
          operator: 'gte',
          value: 7,
        },
      ],

      search: {
        term: 'budget',
      },
    });

    const resolved = resolveDataTableQuery(testPolicy, query);

    const result = testTranslator.translate(resolved);

    expect(result.skip).toBe(150);

    expect(result.take).toBe(50);

    expect(result.orderBy).toEqual([
      {
        office: {
          name: 'asc',
        },
      },

      {
        createdAt: 'desc',
      },
    ]);

    expect(result.where).toEqual({
      AND: [
        {
          status: {
            in: ['ACTIVE', 'PENDING'],
          },
        },

        {
          processingDays: {
            gte: 7,
          },
        },

        {
          OR: [
            {
              title: {
                contains: 'budget',
                mode: 'insensitive',
              },
            },

            {
              description: {
                contains: 'budget',
                mode: 'insensitive',
              },
            },

            {
              documentNumber: {
                contains: 'budget',
                mode: 'insensitive',
              },
            },
          ],
        },
      ],
    });
  });
});
