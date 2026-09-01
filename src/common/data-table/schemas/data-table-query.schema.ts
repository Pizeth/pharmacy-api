// src/common/data-table/schemas/data-table-query.schema.ts

import { z } from 'zod';

/**
 * ------------------------------------------------------------------
 * DataTable server-query limits
 * ------------------------------------------------------------------
 *
 * These are API-level safety/application limits.
 *
 * The frontend may also have UX limits, but only the server limits are
 * authoritative.
 *
 * Client validation is UX.
 * Server validation is authority.
 */

/**
 * Maximum number of rows a single request may ask for.
 */
export const DATA_TABLE_MAX_PAGE_SIZE = 500;

/**
 * Maximum number of simultaneous sorting descriptors.
 */
export const DATA_TABLE_MAX_SORT_DESCRIPTORS = 10;

/**
 * Maximum number of simultaneous filter descriptors.
 */
export const DATA_TABLE_MAX_FILTER_DESCRIPTORS = 50;

/**
 * Maximum number of members accepted by one `in` filter.
 */
export const DATA_TABLE_MAX_IN_FILTER_VALUES = 100;

/**
 * Maximum public DataTable field identifier length.
 */
export const DATA_TABLE_MAX_FIELD_LENGTH = 128;

/**
 * Maximum string filter payload.
 *
 * This keeps generic equality/select/membership filter values bounded.
 */
export const DATA_TABLE_MAX_FILTER_STRING_LENGTH = 500;

/**
 * Maximum global-search term length.
 */
export const DATA_TABLE_MAX_SEARCH_LENGTH = 200;

/**
 * ------------------------------------------------------------------
 * Public DataTable API field identifier
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
 * IMPORTANT:
 *
 * Passing this schema only proves that a field identifier has valid
 * syntax.
 *
 * It does NOT prove that a particular resource allows that field.
 *
 * Phase 1.7.6 will provide that authorization/policy boundary.
 */
export const dataTableFieldSchema = z
  .string()
  .trim()
  .min(1, 'DataTable field must not be empty.')
  .max(
    DATA_TABLE_MAX_FIELD_LENGTH,
    `DataTable field must not exceed ${DATA_TABLE_MAX_FIELD_LENGTH} characters.`,
  )
  .regex(
    /^[A-Za-z0-9_.-]+$/,
    'DataTable field contains unsupported characters.',
  );

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
 * Filter scalar values
 * ------------------------------------------------------------------
 *
 * This intentionally matches our current frontend semantic protocol:
 *
 *   string
 *   number
 *   boolean
 *
 * Dates are intentionally not included yet.
 *
 * Dates will eventually cross the API boundary as strings rather than
 * JavaScript Date objects.
 *
 * Date/date-range support will define a deliberate ISO wire format when
 * those reserved frontend filter variants are implemented.
 */
export const dataTableFilterStringSchema = z
  .string()
  .max(
    DATA_TABLE_MAX_FILTER_STRING_LENGTH,
    `Filter string must not exceed ${DATA_TABLE_MAX_FILTER_STRING_LENGTH} characters.`,
  );

export const dataTableFilterScalarSchema = z.union([
  dataTableFilterStringSchema,
  z.number(),
  z.boolean(),
]);

export type DataTableFilterScalar = z.output<
  typeof dataTableFilterScalarSchema
>;

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

export type DataTableFilterOperator = z.output<
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

export type DataTableEqualsFilter = z.output<
  typeof dataTableEqualsFilterSchema
>;

/**
 * ------------------------------------------------------------------
 * Text contains
 * ------------------------------------------------------------------
 *
 * This operator intentionally accepts only non-empty text.
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
    value: z
      .string()
      .trim()
      .min(1, 'Contains filter must not be empty.')
      .max(
        DATA_TABLE_MAX_FILTER_STRING_LENGTH,
        `Contains filter must not exceed ${DATA_TABLE_MAX_FILTER_STRING_LENGTH} characters.`,
      ),
  })
  .strict();

export type DataTableContainsFilter = z.output<
  typeof dataTableContainsFilterSchema
>;

/**
 * ------------------------------------------------------------------
 * gte
 * ------------------------------------------------------------------
 *
 * Current generic range support is numeric.
 */
export const dataTableGreaterThanOrEqualFilterSchema = z
  .object({
    field: dataTableFieldSchema,

    operator: z.literal('gte'),

    value: z.number(),
  })
  .strict();

export type DataTableGreaterThanOrEqualFilter = z.output<
  typeof dataTableGreaterThanOrEqualFilterSchema
>;

/**
 * ------------------------------------------------------------------
 * lte
 * ------------------------------------------------------------------
 */
export const dataTableLessThanOrEqualFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('lte'),
    value: z.number(),
  })
  .strict();

export type DataTableLessThanOrEqualFilter = z.output<
  typeof dataTableLessThanOrEqualFilterSchema
>;

/**
 * ------------------------------------------------------------------
 * in
 * ------------------------------------------------------------------
 *
 * This will naturally support multi-select filters later.
 */
export const dataTableInFilterSchema = z
  .object({
    field: dataTableFieldSchema,
    operator: z.literal('in'),
    value: z
      .array(dataTableFilterScalarSchema)
      .min(1, 'In filter must contain at least one value.')
      .max(
        DATA_TABLE_MAX_IN_FILTER_VALUES,
        `In filter must not exceed ${DATA_TABLE_MAX_IN_FILTER_VALUES} values.`,
      ),
  })
  .strict();

export type DataTableInFilter = z.output<typeof dataTableInFilterSchema>;

/**
 * ------------------------------------------------------------------
 * Complete DataTable filter union
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

export type DataTableFilter = z.output<typeof dataTableFilterSchema>;

/**
 * ------------------------------------------------------------------
 * Global search
 * ------------------------------------------------------------------
 *
 * The browser supplies only the search term.
 *
 * Searchable fields are deliberately NOT accepted here.
 *
 * Search fields are server-owned resource policy.
 */
export const dataTableSearchSchema = z
  .object({
    term: z
      .string()
      .trim()
      .min(1, 'Search term must not be empty.')
      .max(
        DATA_TABLE_MAX_SEARCH_LENGTH,
        `Search term must not exceed ${DATA_TABLE_MAX_SEARCH_LENGTH} characters.`,
      ),
  })
  .strict();

export type DataTableSearch = z.output<typeof dataTableSearchSchema>;

/**
 * ------------------------------------------------------------------
 * Complete Standard API DataTable query
 * ------------------------------------------------------------------
 *
 * This corresponds to the frontend:
 *
 *   StandardApiDataTableQueryRequest
 *
 * Pagination is one-based on the HTTP boundary:
 *
 *   page = 1
 *
 * while TanStack remains zero-based internally:
 *
 *   pageIndex = 0
 *
 * That translation already happens in the frontend adapter.
 */
export const dataTableQuerySchema = z
  .object({
    /**
     * Coercion allows this schema to remain compatible with simple
     * transport values such as:
     *
     *   "2" -> 2
     *
     * while normal JSON requests can still send:
     *
     *   2
     */
    page: z.coerce
      .number()
      .int('Page must be an integer.')
      .min(1, 'Page must be at least 1.')
      .default(1),

    pageSize: z.coerce
      .number()
      .int('Page size must be an integer.')
      .min(1, 'Page size must be at least 1.')
      .max(
        DATA_TABLE_MAX_PAGE_SIZE,
        `Page size must not exceed ${DATA_TABLE_MAX_PAGE_SIZE}.`,
      )
      .default(25),

    sorting: z
      .array(dataTableSortSchema)
      .max(
        DATA_TABLE_MAX_SORT_DESCRIPTORS,
        `Sorting must not exceed ${DATA_TABLE_MAX_SORT_DESCRIPTORS} descriptors.`,
      )
      .default([]),

    filters: z
      .array(dataTableFilterSchema)
      .max(
        DATA_TABLE_MAX_FILTER_DESCRIPTORS,
        `Filters must not exceed ${DATA_TABLE_MAX_FILTER_DESCRIPTORS} descriptors.`,
      )
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
 *
 * Useful primarily for tests or lower-level integrations.
 */
export type DataTableQueryInput = z.input<typeof dataTableQuerySchema>;

/**
 * Parsed value received by our application/service layer.
 *
 * This is the type controller handlers and resource policy layer
 * should normally use.
 */
export type DataTableQuery = z.output<typeof dataTableQuerySchema>;
