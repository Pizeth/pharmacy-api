// src/common/data-table/prisma/types.ts

import type {
  DataTableFilterOperator,
  DataTableFilterScalar,
  DataTableSortDirection,
} from '../schemas/data-table-query.schema';

import type {
  DataTableFilterOperatorsForTarget,
  DataTableFilterTargetOf,
  DataTableFilterValueForTargetOperator,
  DataTableQueryPolicy,
  DataTableSearchTargetOf,
  DataTableSortTargetOf,
  ResolvedDataTableQueryFor,
} from '../query/types';

/**
 * ------------------------------------------------------------------
 * Sorting mappers
 * ------------------------------------------------------------------
 */

/**
 * Maps one trusted sorting direction to a resource-specific Prisma
 * orderBy object.
 *
 * Example:
 *
 * direction =>
 *   ({
 *     title: direction,
 *   })
 */
export type DataTablePrismaSortMapper<TOrderBy extends object> = (
  direction: DataTableSortDirection,
) => TOrderBy;

/**
 * Every trusted sorting target declared by the resource policy must
 * have an explicit Prisma mapper.
 */
export type DataTablePrismaSortMappers<
  TPolicy extends DataTableQueryPolicy,
  TOrderBy extends object,
> = {
  readonly [
    TTarget in DataTableSortTargetOf<TPolicy>
  ]: DataTablePrismaSortMapper<TOrderBy>;
};

/**
 * ------------------------------------------------------------------
 * Filtering mappers
 * ------------------------------------------------------------------
 */

/**
 * Runtime-compatible mapper family.
 *
 * Every property is optional here because different targets expose
 * different operators.
 *
 * `DataTablePrismaFilterMappers` below makes the operators required
 * according to each resource policy.
 */
export interface DataTablePrismaFilterMapperSet<TWhere extends object> {
  readonly equals?: (value: DataTableFilterScalar) => TWhere;
  readonly contains?: (value: string) => TWhere;
  readonly gte?: (value: number) => TWhere;
  readonly lte?: (value: number) => TWhere;
  readonly in?: (value: readonly DataTableFilterScalar[]) => TWhere;
}

/**
 * Pull one operator's function type out of the runtime mapper family.
 */
type DataTablePrismaFilterMapperForOperator<
  TWhere extends object,
  TOperator extends DataTableFilterOperator,
> = NonNullable<DataTablePrismaFilterMapperSet<TWhere>[TOperator]>;

/**
 * Mapper requirements for a single trusted target.
 *
 * Only the operators declared by the resource policy are required.
 *
 * Example:
 *
 * status:
 *   equals | in
 *
 * produces:
 *
 * {
 *   equals: (...),
 *   in: (...),
 * }
 *
 * while `contains`, `gte`, and `lte` are not required.
 */
type DataTablePrismaRequiredFilterMapperSet<
  TPolicy extends DataTableQueryPolicy,
  TTarget extends string,
  TWhere extends object,
> = {
  readonly [
    TOperator in DataTableFilterOperatorsForTarget<TPolicy, TTarget>
  ]: DataTablePrismaFilterMapperForOperator<TWhere, TOperator>;
};

/**
 * Complete filtering mapper map.
 *
 * The first half gives us a common runtime shape.
 *
 * The second half adds the policy-derived compile-time requirements.
 */
export type DataTablePrismaFilterMappers<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
> = Readonly<
  Record<
    DataTableFilterTargetOf<TPolicy>,
    DataTablePrismaFilterMapperSet<TWhere>
  >
> & {
  readonly [
    TTarget in DataTableFilterTargetOf<TPolicy>
  ]: DataTablePrismaRequiredFilterMapperSet<TPolicy, TTarget, TWhere>;
};

/**
 * ------------------------------------------------------------------
 * Global-search mappers
 * ------------------------------------------------------------------
 */

/**
 * Maps one server-owned search term to one Prisma where clause.
 */
export type DataTablePrismaSearchMapper<TWhere extends object> = (
  term: string,
) => TWhere;

/**
 * Every server-owned search target must have an explicit mapper.
 *
 * For resources without global search this resolves naturally to an
 * empty object type.
 */
export type DataTablePrismaSearchMappers<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
> = {
  readonly [
    TTarget in DataTableSearchTargetOf<TPolicy>
  ]: DataTablePrismaSearchMapper<TWhere>;
};

/**
 * ------------------------------------------------------------------
 * Where combiners
 * ------------------------------------------------------------------
 *
 * Prisma model-specific WhereInput types all expose logical
 * composition, but the generic layer cannot construct a model's
 * generated type directly.
 *
 * Therefore the resource provides these tiny typed factories.
 *
 * Typical Prisma implementation:
 *
 * {
 *   and: clauses => ({
 *     AND: [...clauses],
 *   }),
 *
 *   or: clauses => ({
 *     OR: [...clauses],
 *   }),
 * }
 */
export interface DataTablePrismaWhereCombiners<TWhere extends object> {
  readonly and: (clauses: readonly TWhere[]) => TWhere;
  readonly or: (clauses: readonly TWhere[]) => TWhere;
}

/**
 * ------------------------------------------------------------------
 * Translator configuration
 * ------------------------------------------------------------------
 */
export interface DataTablePrismaTranslatorConfig<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
  TOrderBy extends object,
> {
  /**
   * The exact resource policy this translator belongs to.
   *
   * This lets TypeScript derive all trusted targets directly from the
   * policy.
   */
  readonly policy: TPolicy;

  /**
   * Resource-specific sorting translation.
   */
  readonly sorting: DataTablePrismaSortMappers<TPolicy, TOrderBy>;

  /**
   * Resource-specific filtering translation.
   */
  readonly filtering: DataTablePrismaFilterMappers<TPolicy, TWhere>;

  /**
   * Resource-specific global-search translation.
   *
   * Resources without search still provide:
   *
   *   search: {}
   *
   * This keeps the configuration shape predictable.
   */
  readonly search: DataTablePrismaSearchMappers<TPolicy, TWhere>;

  /**
   * Model-specific Prisma logical-composition factories.
   */
  readonly where: DataTablePrismaWhereCombiners<TWhere>;
}

/**
 * ------------------------------------------------------------------
 * Translation result
 * ------------------------------------------------------------------
 *
 * This is intentionally the subset needed by our paginated DataTable
 * reader.
 *
 * `where` is omitted when no filtering/search is active.
 *
 * `orderBy` is omitted when the browser supplied no sorting.
 *
 * Phase 1.7.8 will add the resource-owned/default ordering behavior
 * required for stable offset pagination.
 */
export interface DataTablePrismaQuery<
  TWhere extends object,
  TOrderBy extends object,
> {
  readonly skip: number;
  readonly take: number;
  readonly where?: TWhere;
  readonly orderBy?: readonly TOrderBy[];
}

/**
 * ------------------------------------------------------------------
 * Offset-page execution
 * ------------------------------------------------------------------
 */

/**
 * Non-empty server-owned default ordering.
 *
 * Offset pagination should always have deterministic ordering.
 *
 * Each resource must therefore provide at least one Prisma-compatible
 * default orderBy expression.
 *
 * Example:
 *
 * [
 *   {
 *     createdAt: 'desc',
 *   },
 *
 *   {
 *     id: 'desc',
 *   },
 * ]
 *
 * Prefer ending the default ordering with a unique field such as an
 * ID so that the default pagination order is deterministic.
 */
export type DataTablePrismaDefaultOrderBy<TOrderBy extends object> = readonly [
  TOrderBy,
  ...TOrderBy[],
];

/**
 * Arguments DBHelper gives to a resource's Prisma `findMany`
 * operation.
 *
 * DBHelper deliberately does not know about:
 *
 *   select
 *   include
 *   model names
 *   Prisma delegates
 *
 * The resource service owns those details.
 */
export interface DataTablePrismaPageFindManyArgs<
  TWhere extends object,
  TOrderBy extends object,
> {
  readonly skip: number;
  readonly take: number;
  readonly where?: TWhere;
  readonly orderBy: readonly TOrderBy[];
}

/**
 * Arguments DBHelper gives to the resource's Prisma count operation.
 *
 * Only `where` is relevant to the total row count.
 */
export interface DataTablePrismaPageCountArgs<TWhere extends object> {
  readonly where?: TWhere;
}

/**
 * Database operations required to execute one DataTable page.
 *
 * The calling resource supplies these operations using its concrete
 * Prisma delegate.
 *
 * Example:
 *
 * {
 *   findMany:
 *     args =>
 *       prisma.document.findMany({
 *         ...args,
 *         select: documentSelect,
 *       }),
 *
 *   count:
 *     args =>
 *       prisma.document.count(args),
 * }
 *
 * This keeps DBHelper completely independent of a particular Prisma
 * model.
 */
export interface DataTablePrismaPageOperations<
  TResult,
  TWhere extends object,
  TOrderBy extends object,
> {
  readonly findMany: (
    args: DataTablePrismaPageFindManyArgs<TWhere, TOrderBy>,
  ) => Promise<TResult[]>;

  readonly count: (
    args: DataTablePrismaPageCountArgs<TWhere>,
  ) => Promise<number>;
}

/**
 * Complete input accepted by DBHelper.getDataTablePage().
 */
export interface GetDataTablePrismaPageParams<
  TResult,
  TWhere extends object,
  TOrderBy extends object,
> {
  /**
   * Fully translated Prisma query produced by Phase 1.7.7.
   */
  readonly query: DataTablePrismaQuery<TWhere, TOrderBy>;

  /**
   * Resource-owned fallback ordering.
   *
   * It is used only when the client did not request sorting.
   */
  readonly defaultOrderBy: DataTablePrismaDefaultOrderBy<TOrderBy>;

  /**
   * Resource-owned Prisma read operations.
   */
  readonly operations: DataTablePrismaPageOperations<TResult, TWhere, TOrderBy>;
}

/**
 * Public translator instance.
 */
export interface DataTablePrismaTranslator<
  TPolicy extends DataTableQueryPolicy,
  TWhere extends object,
  TOrderBy extends object,
> {
  /**
   * Translate an already policy-resolved query.
   *
   * Raw `DataTableQuery` is deliberately not accepted here.
   */
  translate(
    query: ResolvedDataTableQueryFor<TPolicy>,
  ): DataTablePrismaQuery<TWhere, TOrderBy>;
}
