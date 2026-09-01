// src/common/data-table/query/create-data-table-query-policy.ts

import type { DataTableFilterOperator } from '../schemas/data-table-query.schema';
import { DataTableQueryPolicyConfigurationError } from './data-table-query-policy.error';
import type {
  DataTableFilterPolicyEntry,
  DataTableQueryPolicy,
  DataTableSearchPolicy,
  DataTableSortPolicyEntry,
} from './types';

/**
 * Ensure a configured internal target is not empty.
 */
function isNonEmptyTarget(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate all sorting policy entries.
 */
function validateSortingPolicy(
  sorting: Readonly<Record<string, DataTableSortPolicyEntry<string>>>,
): void {
  for (const [field, entry] of Object.entries(sorting)) {
    if (!isNonEmptyTarget(entry.target)) {
      throw new DataTableQueryPolicyConfigurationError({
        code: 'EMPTY_SORT_TARGET',
        field,
        target: entry.target,
        message: `DataTable sorting policy field "${field}" has an empty target.`,
      });
    }
  }
}

/**
 * Validate one field's operator list.
 */
function validateFilterOperators(
  field: string,
  operators: readonly DataTableFilterOperator[],
): void {
  if (operators.length === 0) {
    throw new DataTableQueryPolicyConfigurationError({
      code: 'EMPTY_FILTER_OPERATORS',
      field,
      message: `DataTable filtering policy field "${field}" must allow at least one operator.`,
    });
  }

  const seen = new Set<DataTableFilterOperator>();

  for (const operator of operators) {
    if (seen.has(operator)) {
      throw new DataTableQueryPolicyConfigurationError({
        code: 'DUPLICATE_FILTER_OPERATOR',
        field,
        operator,
        message: `DataTable filtering policy field "${field}" declares operator "${operator}" more than once.`,
      });
    }

    seen.add(operator);
  }
}

/**
 * Validate all filtering policy entries.
 */
function validateFilteringPolicy(
  filtering: Readonly<
    Record<
      string,
      DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>
    >
  >,
): void {
  for (const [field, entry] of Object.entries(filtering)) {
    if (!isNonEmptyTarget(entry.target)) {
      throw new DataTableQueryPolicyConfigurationError({
        code: 'EMPTY_FILTER_TARGET',
        field,
        target: entry.target,
        message: `DataTable filtering policy field "${field}" has an empty target.`,
      });
    }

    validateFilterOperators(field, entry.operators);
  }
}

/**
 * Validate the server-owned global-search target list.
 */
function validateSearchPolicy(
  search: DataTableSearchPolicy<string> | undefined,
): void {
  if (!search) {
    return;
  }

  const seen = new Set<string>();

  for (const target of search.targets) {
    if (!isNonEmptyTarget(target)) {
      throw new DataTableQueryPolicyConfigurationError({
        code: 'EMPTY_SEARCH_TARGET',
        target,
        message: 'DataTable search policy contains an empty target.',
      });
    }

    if (seen.has(target)) {
      throw new DataTableQueryPolicyConfigurationError({
        code: 'DUPLICATE_SEARCH_TARGET',
        target,
        message: `DataTable search policy declares target "${target}" more than once.`,
      });
    }

    seen.add(target);
  }
}

/**
 * Create a resource DataTable query policy while preserving its exact
 * literal types.
 *
 * Example:
 *
 * createDataTableQueryPolicy({
 *   sorting: {
 *     title: {
 *       target: 'title',
 *     },
 *
 *     office: {
 *       target: 'officeName',
 *     },
 *   },
 *
 *   filtering: {
 *     status: {
 *       target: 'status',
 *       operators: [
 *         'equals',
 *         'in',
 *       ],
 *     },
 *   },
 *
 *   search: {
 *     targets: [
 *       'title',
 *       'description',
 *     ],
 *   },
 * });
 *
 *
 * The `const` type parameters preserve:
 *
 *   'title'
 *   'officeName'
 *   'equals'
 *   'in'
 *
 * rather than widening everything to `string`.
 */
export function createDataTableQueryPolicy<
  const TSorting extends Readonly<
    Record<string, DataTableSortPolicyEntry<string>>
  >,
  const TFiltering extends Readonly<
    Record<
      string,
      DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>
    >
  >,
  const TSearch extends DataTableSearchPolicy<string> | undefined = undefined,
>(
  policy: DataTableQueryPolicy<TSorting, TFiltering, TSearch>,
): DataTableQueryPolicy<TSorting, TFiltering, TSearch> {
  validateSortingPolicy(policy.sorting);

  validateFilteringPolicy(policy.filtering);

  validateSearchPolicy(policy.search);

  return policy;
}
