// src/modules/helpers/services/db-helper.ts

import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from 'generated/prisma/client';
import type {
  DataTablePrismaPageCountArgs,
  DataTablePrismaPageFindManyArgs,
  GetDataTablePrismaPageParams,
} from 'common/data-table';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import {
  GetPaginatedDataParams,
  PaginatedDataResult,
  ModelDelegate,
  PaginationMetadata,
  FindByIdParams,
} from 'types/types';

@Injectable() // Make DBHelper injectable
export class DBHelper {
  // Inject PrismaService in the constructor
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes one offset-paginated DataTable query.
   *
   * This is the canonical DB execution path for the new DataTable
   * server architecture.
   *
   * Responsibilities:
   *
   *   - apply translated skip/take
   *   - select client sorting or server default ordering
   *   - execute findMany
   *   - execute count with EXACTLY the same effective `where`
   *   - calculate pagination metadata
   *
   * Responsibilities deliberately NOT handled here:
   *
   *   - parsing HTTP input
   *   - field authorization
   *   - filter operator authorization
   *   - global-search field selection
   *   - building Prisma where expressions
   *   - building Prisma orderBy expressions
   *   - cursor pagination
   *
   * Those responsibilities are handled by earlier DataTable layers.
   */
  public async getDataTablePage<
    TResult,
    TWhere extends object,
    TOrderBy extends object,
  >({
    query,
    defaultOrderBy,
    operations,
  }: GetDataTablePrismaPageParams<TResult, TWhere, TOrderBy>): Promise<
    PaginatedDataResult<TResult>
  > {
    /**
     * ----------------------------------------------------------------
     * Effective ordering
     * ----------------------------------------------------------------
     *
     * The translator provides orderBy only when client sorting exists.
     *
     * Otherwise we use the resource-owned default.
     *
     * DBHelper never invents a field name such as:
     *
     *   { key: 'asc' }
     *
     * because it has no knowledge of the model.
     */
    const effectiveOrderBy: readonly TOrderBy[] =
      query.orderBy && query.orderBy.length > 0
        ? query.orderBy
        : defaultOrderBy;

    /**
     * ----------------------------------------------------------------
     * findMany arguments
     * ----------------------------------------------------------------
     */
    const findManyArgs: DataTablePrismaPageFindManyArgs<TWhere, TOrderBy> =
      query.where
        ? {
            skip: query.skip,
            take: query.take,
            where: query.where,
            orderBy: effectiveOrderBy,
          }
        : {
            skip: query.skip,
            take: query.take,
            orderBy: effectiveOrderBy,
          };

    /**
     * ----------------------------------------------------------------
     * count arguments
     * ----------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * When a where clause exists, this is the exact same object used by
     * findMany.
     *
     * Therefore:
     *
     *   filters
     *   +
     *   global search
     *
     * affect both:
     *
     *   returned rows
     *   totalItems
     *
     * identically.
     */
    const countArgs: DataTablePrismaPageCountArgs<TWhere> = query.where
      ? {
          where: query.where,
        }
      : {};

    /**
     * Execute the page query and total count concurrently.
     *
     * They are independent read operations.
     */
    const [data, total] = await Promise.all([
      operations.findMany(findManyArgs),
      operations.count(countArgs),
    ]);

    /**
     * ----------------------------------------------------------------
     * Pagination metadata
     * ----------------------------------------------------------------
     *
     * Phase 1.7.7 creates:
     *
     *   skip = (page - 1) * pageSize
     *   take = pageSize
     *
     * Therefore the one-based page can be reconstructed safely as:
     *
     *   floor(skip / take) + 1
     */
    const currentPage = Math.floor(query.skip / query.take) + 1;

    const totalPages = Math.ceil(total / query.take);

    const metadata: PaginationMetadata = {
      currentPage,
      pageSize: query.take,
      totalItems: total,
      totalPages,

      /**
       * Example:
       *
       * skip = 0
       * take = 25
       * total = 26
       *
       * 0 + 25 < 26
       *            ↓
       * true
       */
      hasNextPage: query.skip + query.take < total,
      hasPreviousPage: query.skip > 0,
    };

    return {
      data,
      metadata,
    };
  }

  /**
   * Retrieves paginated data from a dynamically selected Prisma model.
   *
   * Supports both application's legacy offset-based (page/pageSize) and cursor-based pagination.
   *
   * @deprecated
   * New server-side DataTable endpoints must use `getDataTablePage()`.
   *
   * The DataTable architecture now resolves:
   *
   *   filtering
   *   searching
   *   sorting
   *
   * before reaching DBHelper, so new DataTable endpoints must not use
   * this method's dynamic `search.fields` mechanism.
   *
   * Existing non-DataTable callers can remain here until they are
   * audited/migrated separately.
   *
   * @param params - Parameters for pagination, filtering, sorting, and selection.
   * @returns A promise that resolves to an object containing the data and pagination metadata.
   */
  public async getPaginatedData<
    // TModelName extends Prisma.ModelName,
    // TModelName extends keyof PrismaClient,
    TModelName extends Prisma.TypeMap['meta']['modelProps'],
    TResult = any, // Simpler: Use 'any' for the result items if detailed inference is too complex
  >({
    model,
    where = {},
    orderBy, // This is now the complex Prisma OrderByInput object or array
    cursor,
    select,
    include,
    page = 1,
    pageSize = 10,
    search,
  }: GetPaginatedDataParams<TModelName>): Promise<
    PaginatedDataResult<TResult>
  > {
    // Build the search query dynamically if provided
    let searchQuery = {};
    if (search && search.term && search.fields.length > 0) {
      searchQuery = {
        OR: search.fields.map((field) => ({
          [field]: {
            contains: search.term,
            mode: 'insensitive',
          },
        })),
      };
    }

    // Base arguments common to all scenarios
    const baseArgs: {
      where?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['where'];
      skip?: number; // Only for offset pagination
      cursor?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['cursor']; // Only for cursor pagination
      take: number;
      orderBy?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['orderBy'];
    } = {
      where: { ...where, ...searchQuery },
      // skip: (page - 1) * pageSize,
      take: pageSize,
      // orderBy: { key: 'asc' },
    };

    // Only add orderBy to commonArgs if it's provided
    if (orderBy) {
      baseArgs.orderBy = orderBy;
    }

    // Handle pagination: cursor takes precedence over offset (page/skip)
    if (cursor) {
      baseArgs.cursor = cursor;
      // `skip` is not used with `cursor` in Prisma, so we don't set baseArgs.skip
    } else {
      // Offset-based pagination
      baseArgs.skip = (page - 1) * pageSize;
    }

    // Declare resolvedArgs with the specific Prisma Args type
    let resolvedArgs: Prisma.Args<PrismaClient[TModelName], 'findMany'>;

    // Conditionally construct the final arguments object
    // This approach helps TypeScript correctly infer types for objects with mutually exclusive properties like select/include
    if (select) {
      resolvedArgs = {
        ...baseArgs,
        select: select,
      } as Prisma.Args<PrismaClient[TModelName], 'findMany'>;
    } else if (include) {
      resolvedArgs = {
        ...baseArgs,
        include: include,
      } as Prisma.Args<PrismaClient[TModelName], 'findMany'>;
    } else {
      resolvedArgs = baseArgs as Prisma.Args<
        PrismaClient[TModelName],
        'findMany'
      >;
    }

    // Use ModelDelegate type assertion for the specific model's delegate for safer access to model methods
    const modelDelegate = this.prisma[model] as ModelDelegate;

    // Fetch items using the dynamically accessed model delegate
    const data = (await modelDelegate.findMany(resolvedArgs)) as TResult[];

    // Get total count based on where conditions (for overall pagination metadata)
    /**
     * IMPORTANT:
     *
     * Reuse the exact effective where condition used by findMany.
     *
     * This fixes two legacy problems:
     *
     * 1. Prisma count arguments expect the filter under `where`.
     *
     * 2. Search/filter conditions must match between findMany() and
     *    count(), otherwise totalItems/totalPages become incorrect.
     */
    const total = await modelDelegate.count(baseArgs.where);

    // Calculate pagination metadata
    let currentPageForMeta = page;
    let hasPreviousPageForMeta = page > 1;

    if (cursor) {
      // For cursor-based pagination, currentPage is effectively 1 (relative to the cursor).
      // hasPreviousPage is false as this simple implementation doesn't look backward from a cursor.
      // For cursor-based pagination, the concept of 'currentPage' is relative.
      // We can set it to 1 to indicate the first page *from the cursor*.
      // 'hasPreviousPage' is typically false because we don't paginate backwards from a cursor with this simple setup.
      // currentPageForMeta = 1;
      currentPageForMeta = 1;
      hasPreviousPageForMeta = false;
    }

    const metadata: PaginationMetadata = {
      currentPage: currentPageForMeta,
      pageSize: pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: data.length === pageSize, //&& (cursor || page * pageSize < total), // If cursor, true if full page. Else, standard offset logic.
      hasPreviousPage: hasPreviousPageForMeta,
    };

    // Refined hasNextPage logic
    if (cursor) {
      // If a cursor was used, and we fetched a full page, it's likely there's more.
      // A more robust check would involve trying to fetch one more item than pageSize,
      // or the caller forming a nextCursor from the returned data.
      metadata.hasNextPage = data.length === pageSize;
    } else {
      // For offset pagination if not using cursor
      metadata.hasNextPage = page * pageSize < total;
    }

    return { data, metadata };
  }

  //   // Find user by ID
  //   async findById(id: number) {
  //     try {
  //       const user = await prisma.user.findUnique({
  //         where: { id },
  //         include: {
  //           profile: true,
  //         },
  //       });
  //       return user ? new User(user) : null;
  //     } catch (error) {
  //       console.error(`Error finding user with id ${id}:`, error);
  //       throw error;
  //     }
  //   }

  /**
   * Finds a single unique record by its unique criteria (e.g., ID).
   * @param params - Parameters including model name, where (unique criteria), and optional select/include.
   * @returns A promise that resolves to the found record or null.
   */
  public async findOne<
    TModelName extends Prisma.TypeMap['meta']['modelProps'],
    TResult = any,
  >({
    model,
    where, // This 'where' must be a unique input for the model
    select,
    include,
  }: FindByIdParams<TModelName>): Promise<TResult | null> {
    let findUniqueArgs: Prisma.Args<PrismaClient[TModelName], 'findUnique'>;

    // Construct the findUniqueArgs object explicitly in each branch
    // and use type assertion for robustness with generic types.
    if (select) {
      findUniqueArgs = {
        where,
        select,
      } as Prisma.Args<PrismaClient[TModelName], 'findUnique'>;
    } else if (include) {
      findUniqueArgs = {
        where,
        include,
      } as Prisma.Args<PrismaClient[TModelName], 'findUnique'>;
    } else {
      findUniqueArgs = {
        where,
      } as Prisma.Args<PrismaClient[TModelName], 'findUnique'>;
    }

    const specificModelDelegate = this.prisma[
      model
    ] as unknown as ModelDelegate;

    // The result of findUnique can be null if not found
    const result = await specificModelDelegate.findUnique(findUniqueArgs);

    return result as TResult | null;
  }
}
