// src/common/data-table/index.ts

/**
 * ------------------------------------------------------------------
 * Query schemas / wire validation
 * ------------------------------------------------------------------
 */

export {
  DATA_TABLE_MAX_FIELD_LENGTH,
  DATA_TABLE_MAX_FILTER_DESCRIPTORS,
  DATA_TABLE_MAX_FILTER_STRING_LENGTH,
  DATA_TABLE_MAX_IN_FILTER_VALUES,
  DATA_TABLE_MAX_PAGE_SIZE,
  DATA_TABLE_MAX_SEARCH_LENGTH,
  DATA_TABLE_MAX_SORT_DESCRIPTORS,
  dataTableContainsFilterSchema,
  dataTableEqualsFilterSchema,
  dataTableFieldSchema,
  dataTableFilterOperatorSchema,
  dataTableFilterScalarSchema,
  dataTableFilterSchema,
  dataTableFilterStringSchema,
  dataTableGreaterThanOrEqualFilterSchema,
  dataTableInFilterSchema,
  dataTableLessThanOrEqualFilterSchema,
  dataTableQuerySchema,
  dataTableSearchSchema,
  dataTableSortDirectionSchema,
  dataTableSortSchema,
} from './schemas/data-table-query.schema';

export type {
  DataTableContainsFilter,
  DataTableEqualsFilter,
  DataTableFilter,
  DataTableFilterOperator,
  DataTableFilterScalar,
  DataTableGreaterThanOrEqualFilter,
  DataTableInFilter,
  DataTableLessThanOrEqualFilter,
  DataTableQuery,
  DataTableQueryInput,
  DataTableSearch,
  DataTableSort,
  DataTableSortDirection,
} from './schemas/data-table-query.schema';

/**
 * ------------------------------------------------------------------
 * Resource query policy
 * ------------------------------------------------------------------
 */

export * from './query';

/**
 * ------------------------------------------------------------------
 * Prisma query translation
 * ------------------------------------------------------------------
 */

export * from './prisma';
