// export interface HotModule {
//   hot?: {
//     accept: () => void;
//     dispose: (callback: () => void) => void;
//   };
// }

import { Prisma, PrismaClient } from '@prisma/client';
import { Readable } from 'stream';
import { HttpErrorStatusEnum, type } from './commons.enum';
import { HttpStatus } from '@nestjs/common';

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
  findMany: (args: any) => Promise<unknown[]>;
  findUnique: (args: any) => Promise<unknown>; // Added for findById
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
type FindManyArgsType<TModelName extends Prisma.TypeMap['meta']['modelProps']> =
  NonNullable<Parameters<PrismaClient[TModelName]['findMany']>[0]>;

// // Helper conditional type to safely extract the 'select' property type
// type SelectPropertyType<Args> = Args extends { select?: infer S }
//   ? S
//   : undefined;
// Helper conditional type to safely extract the 'include' property type
type IncludePropertyType<Args> = Args extends { include?: infer I }
  ? I
  : undefined;

/**
 * Interface for the parameters of the findById method.
 * TModelName represents the name of a Prisma model (e.g., 'user', 'post').
 */
export interface FindByIdParams<
  TModelName extends Prisma.TypeMap['meta']['modelProps'],
> {
  model: TModelName;
  // 'where' for findUnique must be a unique criteria object for the model
  // 'where' is a required property on the FindUniqueArgsType object.
  // where: FindArgsType<TModelName>['where'];
  where: Prisma.Args<PrismaClient[TModelName], 'findUnique'>['where'];
  select?: Prisma.Args<PrismaClient[TModelName], 'findUnique'>['select'];
  // select?: FindArgsType<TModelName>['select']; // Use conditional type
  // select?: SelectPropertyType<FindUniqueArgsType<TModelName>>; // Use conditional type
  include?: IncludePropertyType<FindUniqueArgsType<TModelName>>; // Use conditional type
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
  // include?: Prisma.Args<PrismaClient[TModelName], 'findMany'>['include'];
  include?: IncludePropertyType<FindManyArgsType<TModelName>>; // Use conditional type

  // Pagination control:
  // pageSize is used as 'take' for both cursor and offset pagination.
  // page is used for offset pagination (if cursor is not provided).
  page?: number; // Defaults to 1. Used for offset pagination if cursor is not provided
  pageSize?: number; // Defaults to 10. Used as 'take' for both pagination types
}

// Define interfaces for return types

// Common return types
export interface R2UploadOptions {
  fileName: string;
  buffer: Buffer | Readable;
  mimetype: string;
  maxSizeBytes?: number;
  cacheControl?: string; // e.g., 'max-age=31536000'
  metadata?: Record<string, string>; // Custom metadata
}
// Common Base Interface (DRY principle):
export interface R2BaseResponse {
  message: string;
  fileName: string;
  timestamp?: Date;
}

// For list operations
export interface R2ListResponse extends R2BaseResponse {
  files: {
    name: string;
    size: number;
    uploadedAt: Date;
  }[];
}

// For file metadata types for better type safety
export interface R2FileMetadataResponse extends R2BaseResponse {
  metadata: Record<string, string>;
  mimetype: string;
  size?: number;
  lastModified?: Date;
}

export interface R2PaginatedListResponse extends R2ListResponse {
  pagination: {
    total: number;
    cursor?: string;
    limit: number;
  };
}

// Interface for successful upload response
export interface R2UploadSuccessResponse extends R2BaseResponse {
  type: type.Upload;
  status: HttpStatus.CREATED; // 201
  url: string;
  fileSize?: number; // Optional file size in bytes
  contentType?: string; // Optional MIME type
}

// Interface for error response (can be used by both upload and delete)
// export interface R2ErrorResponse {
//   status: number;
//   message: string;
//   fileName: string;
//   url?: string; // Optional for delete errors
//   error: string;
// }

// Interface for successful delete response
export interface R2DeleteSuccessResponse extends R2BaseResponse {
  type: type.Delete;
  status: StatusCodes.OK; // 200;
}

// Interface for error response (can be used by both upload and delete)
export interface R2ErrorResponse extends R2BaseResponse {
  type: type.Error;
  status: HttpErrorStatusEnum | number; // Use enum or number for status code
  error: string;
  stack?: string; // Useful for debugging in development
  // code?: string; // Cloudflare R2 specific error code
  errorCode?: string; // Optional AWS/R2 specific error code
  url?: string; // Optional for delete errors
}

// Union type for upload response
export type R2UploadResponse = R2UploadSuccessResponse | R2ErrorResponse;
// Union type for delete response
export type R2DeleteResponse = R2DeleteSuccessResponse | R2ErrorResponse;

// export interface VirusTotalResponseOld {
//   data: {
//     attributes: {
//       last_analysis_stats: {
//         malicious: number;
//         suspicious: number;
//       };
//     };
//   };
// }
