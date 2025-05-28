// export interface HotModule {
//   hot?: {
//     accept: () => void;
//     dispose: (callback: () => void) => void;
//   };
// }

import { Prisma, PrismaClient } from '@prisma/client';

export interface WebpackHotModule {
  accept(callback?: (err?: any) => void): void;
  //   dispose(callback: () => void): void;
  dispose(callback: () => void | Promise<void>): void;
}

export interface HotModule extends NodeJS.Module {
  hot?: WebpackHotModule;
}

// declare const module: HotModule;

/**
 * Helper type to extract the actual model type from a Prisma delegate.
 * For example, ModelType<PrismaClient['user']> would be User.
 * This is a bit more advanced and might not be strictly necessary if 'any[]' is acceptable for data.
 */
export type ModelDelegate = {
  findMany: (args: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>; // Added for findById
  count: (args: any) => Promise<number>;
  // Add other methods if needed for more generic helpers
};
export type ExtractModelName<T extends Prisma.ModelName> = T;

/**
 * Interface for the pagination metadata.
 */
export interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Interface for the result of getPaginatedData.
 * TData represents the type of the items in the data array.
 */
export interface PaginatedDataResult<TData> {
  data: TData[];
  metadata: PaginationMetadata;
}

// Helper type to get the actual arguments object type for findUnique
type FindUniqueArgsType<
  TModelName extends Prisma.TypeMap['meta']['modelProps'],
> = NonNullable<Parameters<PrismaClient[TModelName]['findUnique']>[0]>;

/**
 * Interface for the parameters of the findById method.
 */
interface FindByIdParams<
  TModelName extends Prisma.TypeMap['meta']['modelProps'],
> {
  model: TModelName;
  where: FindUniqueArgsType<TModelName>['where']; // Use the helper type
  select?: FindUniqueArgsType<TModelName>['select']; // Use the helper type
  include?: FindUniqueArgsType<TModelName>['include']; // Use the helper type
}
/**
 * Interface for the parameters of the findById method.
 * TModelName represents the name of a Prisma model (e.g., 'user', 'post').
 */
export interface FindByIdParam1s<
  TModelName extends Prisma.TypeMap['meta']['modelProps'],
> {
  model: TModelName;
  // 'where' for findUnique must be a unique criteria object for the model
  where: Prisma.Args<PrismaClient[TModelName], 'findUniqueOrThrow'>['where'];
  select?: Prisma.Args<PrismaClient[TModelName], 'findUnique'>['select'];
  include?: Prisma.Args<PrismaClient[TModelName], 'findUnique'>['include'];
}

/**
 * Interface for the parameters of the getPaginatedData method.
 * TModelName represents the name of a Prisma model (e.g., 'user', 'post').
 */
export interface GetPaginatedDataParams<
  TModelName extends Prisma.TypeMap['meta']['modelProps'],
> {
  model: TModelName;

  // Prisma findMany arguments
  where?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['where'];
  orderBy?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['orderBy']; // Supports complex order objects
  cursor?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['cursor']; // For cursor-based pagination

  // Selection
  select?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['select'];
  include?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['include'];

  // Pagination control:
  // pageSize is used as 'take' for both cursor and offset pagination.
  // page is used for offset pagination (if cursor is not provided).
  page?: number; // Defaults to 1. Used for offset pagination if cursor is not provided
  pageSize?: number; // Defaults to 10. Used as 'take' for both pagination types
}
