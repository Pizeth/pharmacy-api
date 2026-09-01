// src/common/data-table/query/resolve-data-table-query.ts

import type {
  DataTableFilter,
  DataTableFilterOperator,
  DataTableQuery,
} from '../schemas/data-table-query.schema';
import { DataTableQueryPolicyError } from './data-table-query-policy.error';

import type {
  DataTableFilterPolicyEntry,
  DataTableFilterTargetOf,
  DataTableFilterValueForOperator,
  DataTableFilterValueParser,
  DataTableQueryPolicy,
  DataTableSearchTargetOf,
  DataTableSortTargetOf,
  ResolvedDataTableFilter,
  ResolvedDataTableQueryFor,
  ResolvedDataTableSort,
} from './types';

/**
 * Safely read one OWN property from a resource-policy record.
 *
 * This is intentionally safer than:
 *
 *   record[field]
 *
 * alone.
 *
 * Public field syntax currently permits identifiers such as:
 *
 *   constructor
 *   toString
 *   __proto__
 *
 * Those must never accidentally resolve through Object.prototype.
 */
function getOwnPolicyEntry<TValue>(
  record: Readonly<Record<string, TValue>>,
  field: string,
): TValue | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, field)) {
    return undefined;
  }

  return record[field];
}

/**
 * Check whether a resource field explicitly permits an operator.
 *
 * Keeping the parameter widened to the complete operator union avoids
 * readonly tuple `.includes()` inference problems when policies use
 * literal tuples such as:
 *
 *   ['equals', 'in'] as const
 */
function isOperatorAllowed(
  operators: readonly DataTableFilterOperator[],
  operator: DataTableFilterOperator,
): boolean {
  return operators.includes(operator);
}

/**
 * Resolve the optional resource-specific parser for one operator.
 *
 * Because DataTableFilterValueParserMap is keyed by the exact
 * operator union, TypeScript keeps the parser output correlated with
 * the operator.
 */
function getFilterValueParser<TOperator extends DataTableFilterOperator>(
  entry: DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>,

  operator: TOperator,
):
  | DataTableFilterValueParser<DataTableFilterValueForOperator<TOperator>>
  | undefined {
  return entry.values?.[operator];
}

/**
 * Validate/transform a generic filter value using the resource's
 * optional operator-specific parser.
 *
 * No parser:
 *
 *   return the already Zod-validated generic value unchanged.
 *
 * Parser present:
 *
 *   return its validated/transformed output.
 *
 * Parser failure:
 *
 *   convert it into a DataTable resource-policy rejection.
 */
function resolveFilterValue<TOperator extends DataTableFilterOperator>(
  entry: DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>,

  field: string,

  operator: TOperator,

  value: DataTableFilterValueForOperator<TOperator>,
): DataTableFilterValueForOperator<TOperator> {
  const parser = getFilterValueParser(entry, operator);

  if (!parser) {
    return value;
  }

  try {
    return parser.parse(value);
  } catch (cause: unknown) {
    throw new DataTableQueryPolicyError({
      code: 'INVALID_FILTER_VALUE',

      field,

      operator,

      message: `DataTable filter value for field "${field}" and operator "${operator}" is invalid.`,

      cause,
    });
  }
}

/**
 * Resolve one structurally valid filter through the resource policy.
 *
 * At this point:
 *
 *   - target is trusted
 *   - operator is allowed
 *
 * This function additionally performs resource-specific value
 * validation/transformation.
 */
function resolveFilter<TTarget extends string>(
  filter: DataTableFilter,
  target: TTarget,
  entry: DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>,
): ResolvedDataTableFilter<TTarget> {
  switch (filter.operator) {
    case 'equals':
      return {
        field: filter.field,
        target,
        operator: 'equals',
        value: resolveFilterValue(entry, filter.field, 'equals', filter.value),
      };

    case 'contains':
      return {
        field: filter.field,
        target,
        operator: 'contains',
        value: resolveFilterValue(
          entry,
          filter.field,
          'contains',
          filter.value,
        ),
      };

    case 'gte':
      return {
        field: filter.field,
        target,
        operator: 'gte',
        value: resolveFilterValue(entry, filter.field, 'gte', filter.value),
      };

    case 'lte':
      return {
        field: filter.field,
        target,
        operator: 'lte',
        value: resolveFilterValue(entry, filter.field, 'lte', filter.value),
      };

    case 'in':
      return {
        field: filter.field,
        target,
        operator: 'in',
        value: resolveFilterValue(entry, filter.field, 'in', filter.value),
      };
  }
}

/**
 * Resolve sorting through the resource policy.
 */
function resolveSorting<TPolicy extends DataTableQueryPolicy>(
  policy: TPolicy,
  query: DataTableQuery,
): readonly ResolvedDataTableSort<DataTableSortTargetOf<TPolicy>>[] {
  const resolved: ResolvedDataTableSort<DataTableSortTargetOf<TPolicy>>[] = [];

  for (const sort of query.sorting) {
    const entry = getOwnPolicyEntry(policy.sorting, sort.field);

    if (!entry) {
      throw new DataTableQueryPolicyError({
        code: 'UNKNOWN_SORT_FIELD',
        field: sort.field,
        message: `DataTable sorting field "${sort.field}" is not available for this resource.`,
      });
    }

    resolved.push({
      field: sort.field,
      target: entry.target,
      direction: sort.direction,
    });
  }

  return resolved;
}

/**
 * Resolve filters through the resource policy.
 */
function resolveFiltering<TPolicy extends DataTableQueryPolicy>(
  policy: TPolicy,

  query: DataTableQuery,
): readonly ResolvedDataTableFilter<DataTableFilterTargetOf<TPolicy>>[] {
  const resolved: ResolvedDataTableFilter<DataTableFilterTargetOf<TPolicy>>[] =
    [];

  for (const filter of query.filters) {
    const entry:
      | DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>
      | undefined = getOwnPolicyEntry(policy.filtering, filter.field);

    if (!entry) {
      throw new DataTableQueryPolicyError({
        code: 'UNKNOWN_FILTER_FIELD',
        field: filter.field,
        operator: filter.operator,
        message: `DataTable filtering field "${filter.field}" is not available for this resource.`,
      });
    }

    if (!isOperatorAllowed(entry.operators, filter.operator)) {
      throw new DataTableQueryPolicyError({
        code: 'FILTER_OPERATOR_NOT_ALLOWED',
        field: filter.field,
        operator: filter.operator,
        message: `DataTable filter operator "${filter.operator}" is not allowed for field "${filter.field}".`,
      });
    }

    resolved.push(
      resolveFilter(
        filter,
        entry.target as DataTableFilterTargetOf<TPolicy>,
        entry,
      ),
    );
  }

  return resolved;
}

/**
 * Resolve global search.
 *
 * The browser never chooses these targets.
 *
 * Search targets come exclusively from the server-owned resource
 * policy.
 */
function resolveSearch<TPolicy extends DataTableQueryPolicy>(
  policy: TPolicy,

  query: DataTableQuery,
):
  | {
      readonly term: string;
      readonly targets: readonly DataTableSearchTargetOf<TPolicy>[];
    }
  | undefined {
  /**
   * No global search was requested.
   */
  if (!query.search) {
    return undefined;
  }

  /**
   * A search term was supplied, but this resource does not expose
   * global search.
   */
  if (!policy.search || policy.search.targets.length === 0) {
    throw new DataTableQueryPolicyError({
      code: 'GLOBAL_SEARCH_NOT_ALLOWED',
      message: 'Global search is not available for this resource.',
    });
  }

  /**
   * These targets originate exclusively from server policy.
   *
   * No browser-supplied field identifiers participate here.
   */
  return {
    term: query.search.term,
    targets: [...policy.search.targets],
  };
}

/**
 * Resolve a validated generic DataTable query through one resource's
 * server-owned policy.
 *
 * Input guarantees:
 *
 *   ✓ Zod structure validation
 *   ✓ valid semantic filter operator/value combinations
 *
 * This function adds:
 *
 *   ✓ sorting field authorization
 *   ✓ filter field authorization
 *   ✓ per-field operator authorization
 *   ✓ trusted global search targets
 *   ✓ public field → internal target mapping
 *
 * Still intentionally absent:
 *
 *   ✗ Prisma where
 *   ✗ Prisma orderBy
 *   ✗ database calls
 *
 * Those belong to Phase 1.7.7.
 */
export function resolveDataTableQuery<
  const TPolicy extends DataTableQueryPolicy,
>(
  policy: TPolicy,

  query: DataTableQuery,
): ResolvedDataTableQueryFor<TPolicy> {
  const sorting = resolveSorting(policy, query);

  const filters = resolveFiltering(policy, query);

  const search = resolveSearch(policy, query);

  const baseResult = {
    page: query.page,

    pageSize: query.pageSize,

    sorting,

    filters,
  };

  if (!search) {
    return baseResult;
  }

  return {
    ...baseResult,

    search,
  };
}
