import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
// import { PrismaService } from 'src/prisma.service';
import {
  GetPaginatedDataParams,
  PaginatedDataResult,
  ModelDelegate,
  PaginationMetadata,
  FindByIdParams,
} from 'src/types/types';

@Injectable() // Make DBHelper injectable
export class DBHelper {
  // Inject PrismaService in the constructor
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves paginated data from a specified Prisma model.
   * Supports both offset-based (page/pageSize) and cursor-based pagination.
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
  }: GetPaginatedDataParams<TModelName>): Promise<
    PaginatedDataResult<TResult>
  > {
    // Base arguments common to all scenarios
    const baseArgs: {
      where?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['where'];
      skip?: number; // Only for offset pagination
      cursor?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['cursor']; // Only for cursor pagination
      take: number;
      orderBy?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['orderBy'];
    } = {
      where,
      //   skip: (page - 1) * pageSize,
      take: pageSize,
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
    const total = await modelDelegate.count({ where });

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
