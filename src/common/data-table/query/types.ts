// src/common/data-table/query/types.ts

import type {
  DataTableFilterOperator,
  DataTableFilterScalar,
  DataTableSortDirection,
} from '../schemas/data-table-query.schema';

/**
 * ------------------------------------------------------------------
 * Generic operator value types
 * ------------------------------------------------------------------
 */

/**
 * Generic value type accepted by each DataTable filter operator.
 *
 * This represents the generic HTTP semantics established by the
 * DataTable Zod schema.
 *
 * Individual resources may narrow these values further.
 *
 * Examples:
 *
 *   equals
 *     generic:
 *       string | number | boolean
 *
 *     resource:
 *       categoryId -> number
 *
 *
 *   in
 *     generic:
 *       readonly (string | number | boolean)[]
 *
 *     resource:
 *       locale -> readonly string[]
 */
export type DataTableFilterValueForOperator<
  TOperator extends DataTableFilterOperator,
> = TOperator extends 'equals'
  ? DataTableFilterScalar
  : TOperator extends 'contains'
    ? string
    : TOperator extends 'gte'
      ? number
      : TOperator extends 'lte'
        ? number
        : TOperator extends 'in'
          ? readonly DataTableFilterScalar[]
          : never;

/**
 * Minimal parser contract used by the resource policy.
 *
 * Zod schemas satisfy this interface naturally:
 *
 *   z.number().int()
 *   z.string().trim()
 *   z.array(z.string())
 *
 * The common DataTable policy therefore does not need to depend on a
 * Zod-specific schema type.
 */
export interface DataTableFilterValueParser<TValue> {
  parse(value: unknown): TValue;
}

/**
 * Optional resource-specific parser map.
 *
 * Each operator parser must return a value compatible with that
 * operator's generic semantics.
 *
 * Narrower outputs are allowed:
 *
 *   equals:
 *     number
 *
 * is valid because number is part of:
 *
 *   string | number | boolean
 */
export type DataTableFilterValueParserMap = {
  readonly [TOperator in DataTableFilterOperator]?: DataTableFilterValueParser<
    DataTableFilterValueForOperator<TOperator>
  >;
};

/**
 * ------------------------------------------------------------------
 * Policy configuration
 * ------------------------------------------------------------------
 */

/**
 * One public sortable field.
 *
 * `target` is an INTERNAL resource key.
 *
 * It is deliberately not called a Prisma field because this layer
 * does not know or care about Prisma.
 *
 * Example:
 *
 *   API field:
 *     office
 *
 *   Internal target:
 *     officeName
 *
 * Phase 1.7.7 can later decide that:
 *
 *   officeName
 *       ↓
 *   Prisma relation:
 *   office: {
 *     name: ...
 *   }
 */
export interface DataTableSortPolicyEntry<TTarget extends string = string> {
  readonly target: TTarget;
}

/**
 * One public filterable field.
 *
 * `operators` controls which semantic operations are available.
 *
 * `values` optionally narrows/validates the value for individual
 * operators.
 *
 * Example:
 *
 * categoryId: {
 *   target: 'categoryId',
 *
 *   operators: [
 *     'equals',
 *     'in',
 *   ],
 *
 *   values: {
 *     equals:
 *       z.number().int().positive(),
 *
 *     in:
 *       z.array(
 *         z.number().int().positive(),
 *       ),
 *   },
 * }
 *
 * Existing policies without `values` continue to use the generic
 * operator value types.
 */
export interface DataTableFilterPolicyEntry<
  TTarget extends string = string,
  TOperators extends readonly DataTableFilterOperator[] =
    readonly DataTableFilterOperator[],
  TValueParsers extends DataTableFilterValueParserMap =
    DataTableFilterValueParserMap,
> {
  readonly target: TTarget;

  readonly operators: TOperators;

  readonly values?: TValueParsers;
}

/**
 * Global search is server-owned.
 *
 * The browser supplies only:
 *
 *   search.term
 *
 * This policy supplies the internal searchable targets.
 */
export interface DataTableSearchPolicy<TTarget extends string = string> {
  readonly targets: readonly TTarget[];
}

/**
 * Complete resource query policy.
 *
 * We require the sorting/filtering records to exist even when empty:
 *
 *   sorting: {}
 *   filtering: {}
 *
 * That keeps the policy shape predictable.
 */

export interface DataTableQueryPolicy<
  TSorting extends Readonly<Record<string, DataTableSortPolicyEntry<string>>> =
    Readonly<Record<string, DataTableSortPolicyEntry<string>>>,
  TFiltering extends Readonly<
    Record<
      string,
      DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>
    >
  > = Readonly<
    Record<
      string,
      DataTableFilterPolicyEntry<string, readonly DataTableFilterOperator[]>
    >
  >,
  TSearch extends DataTableSearchPolicy<string> | undefined =
    DataTableSearchPolicy<string> | undefined,
> {
  readonly sorting: TSorting;
  readonly filtering: TFiltering;
  readonly search?: TSearch;
}

/**
 * ------------------------------------------------------------------
 * Policy-derived target helpers
 * ------------------------------------------------------------------
 */

/**
 * Union of all internal sorting targets declared by a resource policy.
 */
export type DataTableSortTargetOf<TPolicy extends DataTableQueryPolicy> =
  TPolicy['sorting'][keyof TPolicy['sorting']]['target'];

/**
 * Union of all internal filtering targets declared by a resource policy.
 */
export type DataTableFilterTargetOf<TPolicy extends DataTableQueryPolicy> =
  TPolicy['filtering'][keyof TPolicy['filtering']]['target'];

/**
 * Internal search-target union derived directly from the resource
 * policy's search target tuple/array.
 *
 * Example:
 *
 * search: {
 *   targets: [
 *     'title',
 *     'description',
 *     'documentNumber',
 *   ],
 * }
 *
 * becomes:
 *
 *   'title'
 *   | 'description'
 *   | 'documentNumber'
 *
 * If a resource has no search policy, this resolves to `never`.
 */
export type DataTableSearchTargetOf<TPolicy extends DataTableQueryPolicy> =
  NonNullable<TPolicy['search']>['targets'][number];

/**
 * ------------------------------------------------------------------
 * Policy-derived filter operator helpers
 * ------------------------------------------------------------------
 */

/**
 * Union of all filtering policy entries declared by a resource.
 */

type DataTableFilterPolicyEntryOf<TPolicy extends DataTableQueryPolicy> =
  TPolicy['filtering'][keyof TPolicy['filtering']];

/**
 * Determine the resource-specific value type for one concrete policy
 * entry and one operator.
 *
 * When the entry defines a parser for the operator:
 *
 *   use ReturnType<parser.parse>
 *
 * Otherwise:
 *
 *   fall back to the generic operator value type.
 */
type DataTableFilterValueFromPolicyEntry<
  TEntry,
  TTarget extends string,
  TOperator extends DataTableFilterOperator,
> = TEntry extends {
  readonly target: TTarget;
}
  ? TEntry extends {
      readonly values: infer TValueParsers;
    }
    ? TOperator extends keyof TValueParsers
      ? TValueParsers[TOperator] extends DataTableFilterValueParser<
          infer TValue
        >
        ? TValue
        : DataTableFilterValueForOperator<TOperator>
      : DataTableFilterValueForOperator<TOperator>
    : DataTableFilterValueForOperator<TOperator>
  : never;

/**
 * Resource-specific value type expected by a trusted target/operator
 * combination.
 *
 * Example:
 *
 * policy:
 *
 *   categoryId:
 *     target = 'categoryId'
 *     equals parser = z.number().int()
 *
 *
 * then:
 *
 * DataTableFilterValueForTargetOperator<
 *   typeof policy,
 *   'categoryId',
 *   'equals'
 * >
 *
 * =
 *
 * number
 */
export type DataTableFilterValueForTargetOperator<
  TPolicy extends DataTableQueryPolicy,
  TTarget extends DataTableFilterTargetOf<TPolicy>,
  TOperator extends DataTableFilterOperatorsForTarget<TPolicy, TTarget>,
> = DataTableFilterValueFromPolicyEntry<
  DataTableFilterPolicyEntryOf<TPolicy>,
  TTarget,
  TOperator
>;

/**
 * Extract the allowed operators from one policy entry when its target
 * matches `TTarget`.
 *
 * This helper is intentionally distributive over the policy-entry
 * union.
 */
type DataTableFilterOperatorsFromEntry<TEntry, TTarget extends string> =
  TEntry extends DataTableFilterPolicyEntry<
    infer TEntryTarget,
    infer TOperators
  >
    ? TEntryTarget extends TTarget
      ? TOperators[number]
      : never
    : never;

/**
 * Complete operator union allowed for one trusted internal target.
 *
 * This also handles the case where multiple public API fields map to
 * the same internal target.
 *
 * Example:
 *
 * filtering: {
 *   status: {
 *     target: 'status',
 *     operators: ['equals'],
 *   },
 *
 *   statusGroup: {
 *     target: 'status',
 *     operators: ['in'],
 *   },
 * }
 *
 * produces:
 *
 * DataTableFilterOperatorsForTarget<
 *   typeof policy,
 *   'status'
 * >
 *
 * =
 *
 * 'equals' | 'in'
 */
export type DataTableFilterOperatorsForTarget<
  TPolicy extends DataTableQueryPolicy,
  TTarget extends string,
> = DataTableFilterOperatorsFromEntry<
  DataTableFilterPolicyEntryOf<TPolicy>,
  TTarget
>;

/**
 * ------------------------------------------------------------------
 * Resolved sorting
 * ------------------------------------------------------------------
 */

/**
 * A sorting request after passing through resource policy.
 *
 * `field` is retained for diagnostics/observability.
 *
 * `target` is the trusted internal resource target that later reaches
 * the Prisma translator.
 */
export interface ResolvedDataTableSort<TTarget extends string = string> {
  readonly field: string;
  readonly target: TTarget;
  readonly direction: DataTableSortDirection;
}

/**
 * ------------------------------------------------------------------
 * Resolved filters
 * ------------------------------------------------------------------
 */

interface ResolvedDataTableFilterBase<
  TTarget extends string,
  TOperator extends DataTableFilterOperator,
> {
  /**
   * Original public API field.
   */
  readonly field: string;

  /**
   * Trusted internal target selected by resource policy.
   */
  readonly target: TTarget;
  readonly operator: TOperator;
}

export interface ResolvedDataTableEqualsFilter<
  TTarget extends string = string,
> extends ResolvedDataTableFilterBase<TTarget, 'equals'> {
  readonly value: DataTableFilterScalar;
}

export interface ResolvedDataTableContainsFilter<
  TTarget extends string = string,
> extends ResolvedDataTableFilterBase<TTarget, 'contains'> {
  readonly value: string;
}

export interface ResolvedDataTableGreaterThanOrEqualFilter<
  TTarget extends string = string,
> extends ResolvedDataTableFilterBase<TTarget, 'gte'> {
  readonly value: number;
}

export interface ResolvedDataTableLessThanOrEqualFilter<
  TTarget extends string = string,
> extends ResolvedDataTableFilterBase<TTarget, 'lte'> {
  readonly value: number;
}

export interface ResolvedDataTableInFilter<
  TTarget extends string = string,
> extends ResolvedDataTableFilterBase<TTarget, 'in'> {
  readonly value: readonly DataTableFilterScalar[];
}

/**
 * Complete trusted filter union.
 */
export type ResolvedDataTableFilter<TTarget extends string = string> =
  | ResolvedDataTableEqualsFilter<TTarget>
  | ResolvedDataTableContainsFilter<TTarget>
  | ResolvedDataTableGreaterThanOrEqualFilter<TTarget>
  | ResolvedDataTableLessThanOrEqualFilter<TTarget>
  | ResolvedDataTableInFilter<TTarget>;

/**
 * ------------------------------------------------------------------
 * Resolved global search
 * ------------------------------------------------------------------
 */

export interface ResolvedDataTableSearch<TTarget extends string = string> {
  readonly term: string;

  /**
   * These targets come exclusively from server policy.
   *
   * They never come from the browser.
   */
  readonly targets: readonly TTarget[];
}

/**
 * ------------------------------------------------------------------
 * Complete resolved resource query
 * ------------------------------------------------------------------
 *
 * At this point:
 *
 *   - structure has been validated by Zod
 *   - resource field access has been validated
 *   - resource operators have been validated
 *   - global search targets are trusted
 *
 * But no Prisma query has been created yet.
 */
export interface ResolvedDataTableQuery<
  TSortTarget extends string = string,
  TFilterTarget extends string = string,
  TSearchTarget extends string = string,
> {
  readonly page: number;
  readonly pageSize: number;
  readonly sorting: readonly ResolvedDataTableSort<TSortTarget>[];
  readonly filters: readonly ResolvedDataTableFilter<TFilterTarget>[];
  readonly search?: ResolvedDataTableSearch<TSearchTarget>;
}

/**
 * Convenient policy-derived resolved query type.
 */
export type ResolvedDataTableQueryFor<TPolicy extends DataTableQueryPolicy> =
  ResolvedDataTableQuery<
    DataTableSortTargetOf<TPolicy>,
    DataTableFilterTargetOf<TPolicy>,
    DataTableSearchTargetOf<TPolicy>
  >;
