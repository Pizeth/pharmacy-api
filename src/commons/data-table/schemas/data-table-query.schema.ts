// src/common/data-table/schemas/data-table-query.schema.ts

import { z } from 'zod';

/**
 * ------------------------------------------------------------------
 * DataTable server-query limits
 * ------------------------------------------------------------------
 *
 * These are API-level safety/application limits.
 *
 * They deliberately live on the server even if the frontend has
 * similar constraints.
 *
 * Client validation is UX.
 * Server validation is authority.
 */
export const DATA_TABLE_MAX_PAGE_SIZE = 500;

export const DATA_TABLE_MAX_SORT_DESCRIPTORS = 10;

export const DATA_TABLE_MAX_FILTER_DESCRIPTORS = 50;

export const DATA_TABLE_MAX_IN_FILTER_VALUES = 100;

export const DATA_TABLE_MAX_SEARCH_LENGTH = 200;

/**
 * ------------------------------------------------------------------
 * Public DataTable API field
 * ------------------------------------------------------------------
 *
 * These are PUBLIC API field identifiers.
 *
 * Examples:
 *
 *   title
 *   status
 *   createdAt
 *   office.name
 *   document-number
 *
 * Passing this schema does NOT mean a field is authorized.
 *
 * Resource-specific field whitelisting happens later in Phase 1.7.6.
 */
export const dataTableFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid DataTable field identifier');

/**
 * ------------------------------------------------------------------
 * Sorting
 * ------------------------------------------------------------------
 */
export const dataTableSortDirectionSchema = z.enum(['asc', 'desc']);

export type DataTableSortDirection = z.infer<
  typeof dataTableSortDirectionSchema
>;

export const dataTableSortSchema = z
  .object({
    field: dataTableFieldSchema,
    direction: dataTableSortDirectionSchema,
  })
  .strict();

export type DataTableSort = z.infer<typeof dataTableSortSchema>;

/**
 * ------------------------------------------------------------------
 * Filter scalar
 * ------------------------------------------------------------------
 *
 * This intentionally matches our current frontend semantic protocol:
 *
 *   string
 *   number
 *   boolean
 *
 * Dates will eventually cross the API boundary as strings rather than
 * JavaScript Date objects.
 */
export const dataTableFilterScalarSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

export type DataTableFilterScalar = z.infer<typeof dataTableFilterScalarSchema>;

/**
 * ------------------------------------------------------------------
 * Filter operators
 * ------------------------------------------------------------------
 */
export const dataTableFilterOperatorSchema = z.enum([
  'equals',
  'contains',
  'gte',
  'lte',
  'in',
]);

export type DataTableFilterOperator = z.infer<
  typeof dataTableFilterOperatorSchema
>;

/**
 * ------------------------------------------------------------------
 * Exact equality
 * ------------------------------------------------------------------
 */
export const dataTableEqualsFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('equals'),
    value: dataTableFilterScalarSchema,
  })
  .strict();

/**
 * ------------------------------------------------------------------
 * Text contains
 * ------------------------------------------------------------------
 *
 * "contains" only accepts strings.
 *
 * This is stronger than validating:
 *
 *   operator: enum
 *   value: unknown
 *
 * independently.
 */
export const dataTableContainsFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('contains'),
    value: z.string().trim().min(1),
  })
  .strict();

/**
 * ------------------------------------------------------------------
 * Numeric lower bound
 * ------------------------------------------------------------------
 */
export const dataTableGreaterThanOrEqualFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('gte'),
    value: z.number().finite(),
  })
  .strict();

/**
 * ------------------------------------------------------------------
 * Numeric upper bound
 * ------------------------------------------------------------------
 */
export const dataTableLessThanOrEqualFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('lte'),
    value: z.number().finite(),
  })
  .strict();

/**
 * ------------------------------------------------------------------
 * Membership
 * ------------------------------------------------------------------
 */
export const dataTableInFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('in'),
    value: z
      .array(dataTableFilterScalarSchema)
      .min(1)
      .max(DATA_TABLE_MAX_IN_FILTER_VALUES),
  })
  .strict();

/**
 * ------------------------------------------------------------------
 * Complete DataTable filter
 * ------------------------------------------------------------------
 *
 * Using a discriminated union means `operator` determines the exact
 * allowed value type.
 *
 * Examples:
 *
 *   equals + true       ✓
 *   equals + "ACTIVE"   ✓
 *
 *   contains + "abc"    ✓
 *   contains + 123      ✗
 *
 *   gte + 18            ✓
 *   gte + "18"          ✗
 *
 *   in + ["A", "B"]     ✓
 *   in + []             ✗
 *
 * This replaces the custom class-validator decorator from the older
 * implementation entirely.
 */
export const dataTableFilterSchema = z.discriminatedUnion('operator', [
  dataTableEqualsFilterSchema,
  dataTableContainsFilterSchema,
  dataTableGreaterThanOrEqualFilterSchema,
  dataTableLessThanOrEqualFilterSchema,
  dataTableInFilterSchema,
]);

export type DataTableFilter = z.infer<typeof dataTableFilterSchema>;

/**
 * ------------------------------------------------------------------
 * Global search
 * ------------------------------------------------------------------
 *
 * Notice that searchable fields are NOT accepted from the browser.
 *
 * Search fields are server-owned resource policy.
 */
export const dataTableSearchSchema = z
  .object({
    term: z.string().trim().min(1).max(DATA_TABLE_MAX_SEARCH_LENGTH),
  })
  .strict();

export type DataTableSearch = z.infer<typeof dataTableSearchSchema>;

/**
 * ------------------------------------------------------------------
 * Complete Standard API DataTable query
 * ------------------------------------------------------------------
 *
 * This corresponds to the frontend:
 *
 *   StandardApiDataTableQueryRequest
 *
 * Pagination is one-based on the wire:
 *
 *   page = 1
 *
 * while TanStack remains zero-based:
 *
 *   pageIndex = 0
 *
 * That translation already happens in our frontend adapter.
 */
export const dataTableQuerySchema = z
  .object({
    /**
     * z.coerce allows this schema to work with query-string values:
     *
     *   "2" -> 2
     *
     * as well as JSON-body values:
     *
     *   2 -> 2
     */
    page: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(DATA_TABLE_MAX_PAGE_SIZE)
      .default(25),

    sorting: z
      .array(dataTableSortSchema)
      .max(DATA_TABLE_MAX_SORT_DESCRIPTORS)
      .default([]),

    filters: z
      .array(dataTableFilterSchema)
      .max(DATA_TABLE_MAX_FILTER_DESCRIPTORS)
      .default([]),

    search: dataTableSearchSchema.optional(),
  })
  /**
   * Reject unknown properties rather than silently carrying arbitrary
   * browser input farther into the application.
   */
  .strict();

/**
 * Raw input accepted by the schema.
 *
 * This can differ from the output because:
 *
 * - page/pageSize may be coerced
 * - defaults may be applied
 */
export type DataTableQueryInput = z.input<typeof dataTableQuerySchema>;

/**
 * Parsed value received by our application/service layer.
 *
 * This is the type controller handlers should normally use.
 */
export type DataTableQuery = z.output<typeof dataTableQuerySchema>;
