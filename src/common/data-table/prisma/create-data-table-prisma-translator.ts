// src/common/data-table/prisma/create-data-table-prisma-translator.ts

import type { DataTableFilterOperator } from '../schemas/data-table-query.schema';

import type {
  DataTableFilterTargetOf,
  DataTableQueryPolicy,
  DataTableSearchTargetOf,
  DataTableSortTargetOf,
  ResolvedDataTableFilter,
  ResolvedDataTableQueryFor,
} from '../query/types';

import { DataTablePrismaTranslatorConfigurationError } from './data-table-prisma-translator.error';

import type {
  DataTablePrismaFilterMapperSet,
  DataTablePrismaFilterMappers,
  DataTablePrismaQuery,
  DataTablePrismaSearchMappers,
  DataTablePrismaSortMapper,
  DataTablePrismaSortMappers,
  DataTablePrismaTranslator,
  DataTablePrismaTranslatorConfig,
} from './types';

/**
 * Determine whether an object owns a property directly.
 *
 * We never use inherited properties when resolving server-owned target
 * maps.
 */
function hasOwnProperty(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Read an own property as `unknown`.
 *
 * This is a genuine erased runtime-reflection boundary and is used
 * only while validating developer configuration.
 */
function getOwnUnknown(value: object, key: PropertyKey): unknown {
  if (!hasOwnProperty(value, key)) {
    return undefined;
  }

  return Reflect.get(value, key);
}

/**
 * Validate one configured function at a runtime reflection boundary.
 */
function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

/**
 * ------------------------------------------------------------------
 * Configuration validation
 * ------------------------------------------------------------------
 */

function validateSortingMappers(
  policy: DataTableQueryPolicy,

  sorting: object,
): void {
  for (const entry of Object.values(policy.sorting)) {
    const mapper = getOwnUnknown(sorting, entry.target);

    if (!isFunction(mapper)) {
      throw new DataTablePrismaTranslatorConfigurationError({
        code: 'MISSING_SORT_MAPPER',
        target: entry.target,
        message: `DataTable Prisma translator is missing the sorting mapper for target "${entry.target}".`,
      });
    }
  }
}

function validateFilteringMappers(
  policy: DataTableQueryPolicy,

  filtering: object,
): void {
  for (const entry of Object.values(policy.filtering)) {
    const mapperSet = getOwnUnknown(filtering, entry.target);

    if (typeof mapperSet !== 'object' || mapperSet === null) {
      throw new DataTablePrismaTranslatorConfigurationError({
        code: 'MISSING_FILTER_MAPPER',
        target: entry.target,
        message: `DataTable Prisma translator is missing the filtering mapper for target "${entry.target}".`,
      });
    }

    for (const operator of entry.operators) {
      const mapper = getOwnUnknown(mapperSet, operator);

      if (!isFunction(mapper)) {
        throw new DataTablePrismaTranslatorConfigurationError({
          code: 'MISSING_FILTER_OPERATOR_MAPPER',
          target: entry.target,
          operator,
          message: `DataTable Prisma translator target "${entry.target}" is missing mapper for operator "${operator}".`,
        });
      }
    }
  }
}

function validateSearchMappers(
  policy: DataTableQueryPolicy,
  search: object,
): void {
  if (!policy.search) {
    return;
  }

  for (const target of policy.search.targets) {
    const mapper = getOwnUnknown(search, target);

    if (!isFunction(mapper)) {
      throw new DataTablePrismaTranslatorConfigurationError({
        code: 'MISSING_SEARCH_MAPPER',
        target,
        message: `DataTable Prisma translator is missing the global-search mapper for target "${target}".`,
      });
    }
  }
}

/**
 * ------------------------------------------------------------------
 * Strongly typed mapper lookup
 * ------------------------------------------------------------------
 */

function getSortMapper<
  TPolicy extends DataTableQueryPolicy,
  TOrderBy extends object,
>(
  mappers: DataTablePrismaSortMappers<TPolicy, TOrderBy>,
  target: DataTableSortTargetOf<TPolicy>,
): DataTablePrismaSortMapper<TOrderBy> {
  return mappers[target];
}

function getFilterMapperSet<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
>(
  mappers: DataTablePrismaFilterMappers<TPolicy, TWhere>,
  target: DataTableFilterTargetOf<TPolicy>,
): DataTablePrismaFilterMapperSet<TWhere> {
  return mappers[target];
}

function getSearchMapper<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
>(
  mappers: DataTablePrismaSearchMappers<TPolicy, TWhere>,
  target: DataTableSearchTargetOf<TPolicy>,
): (term: string) => TWhere {
  return mappers[target];
}

/**
 * ------------------------------------------------------------------
 * Filter translation
 * ------------------------------------------------------------------
 */

function missingFilterOperatorMapper(
  target: string,
  operator: DataTableFilterOperator,
): DataTablePrismaTranslatorConfigurationError {
  return new DataTablePrismaTranslatorConfigurationError({
    code: 'MISSING_FILTER_OPERATOR_MAPPER',
    target,
    operator,
    message: `DataTable Prisma translator target "${target}" is missing mapper for operator "${operator}".`,
  });
}

function translateFilter<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
>(
  mappers: DataTablePrismaFilterMappers<TPolicy, TWhere>,
  filter: ResolvedDataTableFilter<DataTableFilterTargetOf<TPolicy>>,
): TWhere {
  const mapperSet = getFilterMapperSet(mappers, filter.target);

  /**
   * The switch keeps each filter value correctly narrowed to the
   * operator-specific Zod type.
   */
  switch (filter.operator) {
    case 'equals': {
      const mapper = mapperSet.equals;

      if (!mapper) {
        throw missingFilterOperatorMapper(filter.target, 'equals');
      }

      return mapper(filter.value);
    }

    case 'contains': {
      const mapper = mapperSet.contains;

      if (!mapper) {
        throw missingFilterOperatorMapper(filter.target, 'contains');
      }

      return mapper(filter.value);
    }

    case 'gte': {
      const mapper = mapperSet.gte;

      if (!mapper) {
        throw missingFilterOperatorMapper(filter.target, 'gte');
      }

      return mapper(filter.value);
    }

    case 'lte': {
      const mapper = mapperSet.lte;

      if (!mapper) {
        throw missingFilterOperatorMapper(filter.target, 'lte');
      }

      return mapper(filter.value);
    }

    case 'in': {
      const mapper = mapperSet.in;

      if (!mapper) {
        throw missingFilterOperatorMapper(filter.target, 'in');
      }

      return mapper(filter.value);
    }
  }
}

/**
 * ------------------------------------------------------------------
 * Logical where composition
 * ------------------------------------------------------------------
 */

/**
 * Combine clauses with AND only when necessary.
 *
 * 0 clauses:
 *   undefined
 *
 * 1 clause:
 *   clause
 *
 * 2+ clauses:
 *   AND(...)
 */
function combineAnd<TWhere extends object>(
  clauses: readonly TWhere[],
  combine: (clauses: readonly TWhere[]) => TWhere,
): TWhere | undefined {
  const first = clauses[0];

  if (first === undefined) {
    return undefined;
  }

  if (clauses.length === 1) {
    return first;
  }

  return combine(clauses);
}

/**
 * Combine search clauses with OR only when necessary.
 */
function combineOr<TWhere extends object>(
  clauses: readonly TWhere[],
  combine: (clauses: readonly TWhere[]) => TWhere,
): TWhere | undefined {
  const first = clauses[0];

  if (first === undefined) {
    return undefined;
  }

  if (clauses.length === 1) {
    return first;
  }

  return combine(clauses);
}

/**
 * ------------------------------------------------------------------
 * Query translation
 * ------------------------------------------------------------------
 */

function translateQuery<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
  TOrderBy extends object,
>(
  config: DataTablePrismaTranslatorConfig<TPolicy, TWhere, TOrderBy>,

  query: ResolvedDataTableQueryFor<TPolicy>,
): DataTablePrismaQuery<TWhere, TOrderBy> {
  /**
   * TanStack uses a zero-based page index internally, but the API and
   * resolved backend query are one-based.
   *
   * page 1:
   *   skip 0
   *
   * page 2 with pageSize 25:
   *   skip 25
   */
  const skip = (query.page - 1) * query.pageSize;

  /**
   * Preserve the client's sorting precedence.
   *
   * Prisma accepts an array of orderBy objects for multi-column
   * sorting.
   */
  const orderBy = query.sorting.map((sort) => {
    const mapper = getSortMapper(config.sorting, sort.target);

    return mapper(sort.direction);
  });

  /**
   * Every column filter is conjunctive.
   *
   * Example:
   *
   * status = ACTIVE
   * AND
   * processingDays >= 5
   * AND
   * processingDays <= 30
   */
  const whereClauses: TWhere[] = query.filters.map((filter) =>
    translateFilter(config.filtering, filter),
  );

  /**
   * Global search is:
   *
   * target A contains term
   * OR
   * target B contains term
   * OR
   * target C contains term
   *
   * The resulting search group is then ANDed with the column filters.
   */
  if (query.search) {
    const search = query.search;

    const searchClauses = search.targets.map((target) => {
      const mapper = getSearchMapper(config.search, target);
      return mapper(search.term);
    });

    const searchWhere = combineOr(searchClauses, config.where.or);

    if (searchWhere) {
      whereClauses.push(searchWhere);
    }
  }

  const where = combineAnd(whereClauses, config.where.and);

  const baseResult = {
    skip,
    take: query.pageSize,
  };

  /**
   * Avoid emitting empty/undefined Prisma options.
   */
  if (!where && orderBy.length === 0) {
    return baseResult;
  }

  if (!where) {
    return {
      ...baseResult,
      orderBy,
    };
  }

  if (orderBy.length === 0) {
    return {
      ...baseResult,
      where,
    };
  }

  return {
    ...baseResult,

    where,
    orderBy,
  };
}

/**
 * ------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------
 */

/**
 * Create a strongly typed Prisma translator factory for one Prisma
 * model input family.
 *
 * Usage:
 *
 * createDataTablePrismaTranslator<
 *   Prisma.DocumentWhereInput,
 *   Prisma.DocumentOrderByWithRelationInput
 * >()({
 *   policy,
 *   ...
 * });
 *
 * `TPolicy` is inferred automatically from the supplied resource
 * policy, while the Prisma-generated input types are explicit.
 */
export function createDataTablePrismaTranslator<
  TWhere extends object,
  TOrderBy extends object,
>() {
  return <const TPolicy extends DataTableQueryPolicy>(
    config: DataTablePrismaTranslatorConfig<TPolicy, TWhere, TOrderBy>,
  ): DataTablePrismaTranslator<TPolicy, TWhere, TOrderBy> => {
    /**
     * Fail early if server policy and persistence translation drift
     * apart.
     */
    validateSortingMappers(config.policy, config.sorting);

    validateFilteringMappers(config.policy, config.filtering);

    validateSearchMappers(config.policy, config.search);

    return {
      translate: (query) => translateQuery(config, query),
    };
  };
}
