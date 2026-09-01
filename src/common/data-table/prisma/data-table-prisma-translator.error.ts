// src/common/data-table/prisma/data-table-prisma-translator.error.ts

import type { DataTableFilterOperator } from '../schemas/data-table-query.schema';

export type DataTablePrismaTranslatorConfigurationErrorCode =
  | 'MISSING_SORT_MAPPER'
  | 'MISSING_FILTER_MAPPER'
  | 'MISSING_FILTER_OPERATOR_MAPPER'
  | 'MISSING_SEARCH_MAPPER';

/**
 * Indicates an invalid SERVER-SIDE Prisma translator configuration.
 *
 * This is never a bad browser request.
 *
 * It means a developer added a target/operator to a resource policy
 * without providing the corresponding persistence translation.
 */
export class DataTablePrismaTranslatorConfigurationError extends Error {
  readonly code: DataTablePrismaTranslatorConfigurationErrorCode;
  readonly target?: string;
  readonly operator?: DataTableFilterOperator;

  constructor(options: {
    readonly code: DataTablePrismaTranslatorConfigurationErrorCode;
    readonly message: string;
    readonly target?: string;
    readonly operator?: DataTableFilterOperator;
  }) {
    super(options.message);

    this.name = 'DataTablePrismaTranslatorConfigurationError';
    this.code = options.code;
    this.target = options.target;
    this.operator = options.operator;
  }
}
