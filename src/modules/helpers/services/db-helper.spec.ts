// src/modules/helpers/services/db-helper.spec.ts

import type {
  DataTablePrismaPageCountArgs,
  DataTablePrismaPageFindManyArgs,
  DataTablePrismaQuery,
} from 'common/data-table';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { DBHelper } from './db-helper';

/**
 * ------------------------------------------------------------------
 * Test-only persistence shapes
 * ------------------------------------------------------------------
 *
 * These represent the minimum shapes required by DBHelper.
 *
 * They deliberately do not import a production Prisma model because
 * DBHelper.getDataTablePage() itself is model-independent.
 */

interface TestWhereInput {
  readonly status?: {
    readonly equals: string;
  };

  readonly OR?: readonly TestWhereInput[];
}

interface TestOrderByInput {
  readonly createdAt?: 'asc' | 'desc';
  readonly id?: 'asc' | 'desc';
  readonly title?: 'asc' | 'desc';
}

interface TestRow {
  readonly id: number;
  readonly title: string;
}

/**
 * ------------------------------------------------------------------
 * Test helper
 * ------------------------------------------------------------------
 *
 * Create DBHelper without constructing a real Prisma connection.
 *
 * getDataTablePage() does not access the injected PrismaService.
 *
 * The actual model operations are supplied through:
 *
 *   operations.findMany()
 *   operations.count()
 *
 * Therefore a test-only structural placeholder is enough.
 */
function createDbHelper(): DBHelper {
  //   const prisma = Object.create(PrismaService.prototype) as PrismaService;
  const prisma = {} as PrismaService;
  return new DBHelper(prisma);
}

describe('DBHelper.getDataTablePage', () => {
  it('uses the exact same where object for findMany and count', async () => {
    const helper = createDbHelper();

    const where: TestWhereInput = {
      status: {
        equals: 'ACTIVE',
      },
    };

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      skip: 0,
      take: 25,
      where,
    };

    let findManyArgs:
      | DataTablePrismaPageFindManyArgs<TestWhereInput, TestOrderByInput>
      | undefined;

    let countArgs: DataTablePrismaPageCountArgs<TestWhereInput> | undefined;

    await helper.getDataTablePage({
      query,
      defaultOrderBy: [
        {
          id: 'desc',
        },
      ],

      /**
       * Do NOT make these callbacks async unless they actually
       * await something.
       *
       * The interface requires Promise<TestRow[]>, so returning
       * Promise.resolve(...) is sufficient.
       */
      operations: {
        findMany: async (args) => {
          findManyArgs = args;
          return Promise.resolve([]);
        },

        count: async (args) => {
          countArgs = args;
          return Promise.resolve(0);
        },
      },
    });

    expect(findManyArgs?.where).toBe(where);

    expect(countArgs?.where).toBe(where);

    expect(findManyArgs?.where).toBe(countArgs?.where);
  });

  it('uses the server-owned default order when the query has no sorting', async () => {
    const helper = createDbHelper();

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      skip: 0,

      take: 25,
    };

    let findManyArgs:
      | DataTablePrismaPageFindManyArgs<TestWhereInput, TestOrderByInput>
      | undefined;

    await helper.getDataTablePage({
      query,

      defaultOrderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      operations: {
        findMany: async (args) => {
          findManyArgs = args;
          return Promise.resolve([]);
        },

        count: () => Promise.resolve(0),
      },
    });

    expect(findManyArgs?.orderBy).toEqual([
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
      },
    ]);
  });

  it('uses translated client sorting instead of the default order', async () => {
    const helper = createDbHelper();

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      skip: 0,
      take: 25,
      orderBy: [
        {
          title: 'asc',
        },
      ],
    };

    let findManyArgs:
      | DataTablePrismaPageFindManyArgs<TestWhereInput, TestOrderByInput>
      | undefined;

    await helper.getDataTablePage({
      query,
      defaultOrderBy: [
        {
          id: 'desc',
        },
      ],

      operations: {
        findMany: async (args) => {
          findManyArgs = args;
          return Promise.resolve([]);
        },

        count: () => Promise.resolve(0),
      },
    });

    expect(findManyArgs?.orderBy).toEqual([
      {
        title: 'asc',
      },
    ]);
  });

  it('calculates offset pagination metadata correctly', async () => {
    const helper = createDbHelper();

    const rows: TestRow[] = [
      {
        id: 51,
        title: 'A',
      },

      {
        id: 52,
        title: 'B',
      },
    ];

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      /**
       * Page 3 with pageSize 25.
       */
      skip: 50,
      take: 25,
    };

    const result = await helper.getDataTablePage({
      query,

      defaultOrderBy: [
        {
          id: 'desc',
        },
      ],

      operations: {
        findMany: async () => Promise.resolve(rows),

        /**
         * 80 rows:
         *
         * totalPages = 4
         *
         * Page 3:
         *
         *   hasPreviousPage = true
         *   hasNextPage     = true
         */
        count: () => Promise.resolve(80),
      },
    });

    expect(result.data).toBe(rows);

    expect(result.metadata).toEqual({
      currentPage: 3,
      pageSize: 25,
      totalItems: 80,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('reports the final page correctly', async () => {
    const helper = createDbHelper();

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      /**
       * Page 4 with pageSize 25:
       *
       * (4 - 1) * 25
       * =
       * 75
       */
      skip: 75,
      take: 25,
    };

    const result = await helper.getDataTablePage({
      query,
      defaultOrderBy: [
        {
          id: 'desc',
        },
      ],

      operations: {
        findMany: async () => Promise.resolve([]),
        count: async () => Promise.resolve(80),
      },
    });

    expect(result.metadata).toEqual({
      currentPage: 4,
      pageSize: 25,
      totalItems: 80,
      totalPages: 4,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('returns zero total pages for an empty dataset', async () => {
    const helper = createDbHelper();

    const query: DataTablePrismaQuery<TestWhereInput, TestOrderByInput> = {
      skip: 0,
      take: 25,
    };

    const result = await helper.getDataTablePage({
      query,
      defaultOrderBy: [
        {
          id: 'desc',
        },
      ],

      operations: {
        findMany: async () => await Promise.resolve([]),
        count: async () => await Promise.resolve(0),
      },
    });

    expect(result.metadata).toEqual({
      currentPage: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
