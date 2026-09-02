// src/common/data-table/http/resolve-data-table-query-for-http.ts

import { BadRequestException } from '@nestjs/common';
import type { DataTableQuery } from '../schemas/data-table-query.schema';
import { DataTableQueryPolicyError } from '../query/data-table-query-policy.error';
import { resolveDataTableQuery } from '../query/resolve-data-table-query';
import type {
  DataTableQueryPolicy,
  ResolvedDataTableQueryFor,
} from '../query/types';

/**
 * Resolve one structurally validated DataTable query through its
 * resource policy at an HTTP boundary.
 *
 * Domain/resource-policy failures become HTTP 400 responses.
 *
 * Unexpected errors continue upward untouched.
 */
export function resolveDataTableQueryForHttp<
  const TPolicy extends DataTableQueryPolicy,
>(policy: TPolicy, query: DataTableQuery): ResolvedDataTableQueryFor<TPolicy> {
  try {
    return resolveDataTableQuery(policy, query);
  } catch (error: unknown) {
    /**
     * Unknown programming/runtime failures should NOT be disguised as
     * client errors.
     */
    if (!(error instanceof DataTableQueryPolicyError)) {
      throw error;
    }

    /**
     * Build a compact structured 400 payload.
     *
     * Undefined properties are omitted rather than serialized.
     */
    const response = {
      code: error.code,
      message: error.message,
      ...(error.field !== undefined
        ? {
            field: error.field,
          }
        : {}),

      ...(error.operator !== undefined
        ? {
            operator: error.operator,
          }
        : {}),
    };

    throw new BadRequestException(response);
  }
}
