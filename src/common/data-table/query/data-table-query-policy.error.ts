// src/common/data-table/query/data-table-query-policy.error.ts

import type { DataTableFilterOperator } from '../schemas/data-table-query.schema';

/**
 * ------------------------------------------------------------------
 * Invalid policy configuration
 * ------------------------------------------------------------------
 */

export type DataTableQueryPolicyConfigurationErrorCode =
  | 'EMPTY_SORT_TARGET'
  | 'EMPTY_FILTER_TARGET'
  | 'EMPTY_FILTER_OPERATORS'
  | 'DUPLICATE_FILTER_OPERATOR'
  | 'EMPTY_SEARCH_TARGET'
  | 'DUPLICATE_SEARCH_TARGET';

/**
 * Raised while defining the server-owned resource policy itself.
 *
 * This represents an application programming/configuration error.
 */
export class DataTableQueryPolicyConfigurationError extends Error {
  readonly code: DataTableQueryPolicyConfigurationErrorCode;
  readonly field?: string;
  readonly target?: string;
  readonly operator?: DataTableFilterOperator;

  constructor(options: {
    readonly code: DataTableQueryPolicyConfigurationErrorCode;
    readonly message: string;
    readonly field?: string;
    readonly target?: string;
    readonly operator?: DataTableFilterOperator;
  }) {
    super(options.message);

    this.name = 'DataTableQueryPolicyConfigurationError';
    this.code = options.code;
    this.field = options.field;
    this.target = options.target;
    this.operator = options.operator;
  }
}

/**
 * ------------------------------------------------------------------
 * Rejected client query
 * ------------------------------------------------------------------
 */
export type DataTableQueryPolicyErrorCode =
  | 'UNKNOWN_SORT_FIELD'
  | 'UNKNOWN_FILTER_FIELD'
  | 'FILTER_OPERATOR_NOT_ALLOWED'
  | 'INVALID_FILTER_VALUE'
  | 'GLOBAL_SEARCH_NOT_ALLOWED';

/**
 * Raised when a structurally valid DataTable request attempts an
 * operation/value that the resource policy does not expose.
 *
 * This will become an HTTP 400 response at the controller/application
 * boundary in a later integration step.
 *
 * Keeping this class Nest-independent makes the policy engine easy to
 * test and reuse.
 */
export class DataTableQueryPolicyError extends Error {
  readonly code: DataTableQueryPolicyErrorCode;
  readonly field?: string;
  readonly operator?: DataTableFilterOperator;

  constructor(options: {
    readonly code: DataTableQueryPolicyErrorCode;
    readonly message: string;
    readonly field?: string;
    readonly operator?: DataTableFilterOperator;
    /**
     * Original validation/parser failure.
     *
     * For Zod-backed resource parsers this will normally be a
     * ZodError, but the common layer deliberately keeps it unknown.
     */
    readonly cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });

    this.name = 'DataTableQueryPolicyError';
    this.code = options.code;
    this.field = options.field;
    this.operator = options.operator;
  }
}
