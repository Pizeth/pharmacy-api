// src/common/data-table/query/resolve-data-table-query.spec.ts

import { dataTableQuerySchema } from '../schemas/data-table-query.schema';
import { createDataTableQueryPolicy } from './create-data-table-query-policy';
import {
  DataTableQueryPolicyConfigurationError,
  DataTableQueryPolicyError,
} from './data-table-query-policy.error';
import { resolveDataTableQuery } from './resolve-data-table-query';
import { z } from 'zod';

/**
 * Test-only resource policy.
 *
 * Notice that public API names can differ from internal targets:
 *
 *   office
 *     ↓
 *   officeName
 */
const testPolicy = createDataTableQueryPolicy({
  sorting: {
    title: {
      target: 'title',
    },

    office: {
      target: 'officeName',
    },

    createdAt: {
      target: 'createdAt',
    },
  },

  filtering: {
    title: {
      target: 'title',
      operators: ['contains', 'equals'],
    },

    status: {
      target: 'status',
      operators: ['equals', 'in'],
    },

    processingDays: {
      target: 'processingDays',
      operators: ['equals', 'gte', 'lte'],
    },

    enabled: {
      target: 'isEnabled',
      operators: ['equals'],
    },
  },

  search: {
    targets: ['title', 'description', 'documentNumber'],
  },
});

describe('resolveDataTableQuery', () => {
  it('resolves a valid query through resource policy', () => {
    const query = dataTableQuerySchema.parse({
      page: 3,

      pageSize: 100,

      sorting: [
        {
          field: 'office',
          direction: 'asc',
        },
      ],

      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'ACTIVE',
        },

        {
          field: 'processingDays',
          operator: 'gte',
          value: 5,
        },

        {
          field: 'processingDays',
          operator: 'lte',
          value: 30,
        },
      ],

      search: {
        term: 'budget',
      },
    });

    const result = resolveDataTableQuery(testPolicy, query);

    expect(result).toEqual({
      page: 3,

      pageSize: 100,

      sorting: [
        {
          field: 'office',
          target: 'officeName',
          direction: 'asc',
        },
      ],

      filters: [
        {
          field: 'status',
          target: 'status',
          operator: 'equals',
          value: 'ACTIVE',
        },

        {
          field: 'processingDays',
          target: 'processingDays',
          operator: 'gte',
          value: 5,
        },

        {
          field: 'processingDays',
          target: 'processingDays',
          operator: 'lte',
          value: 30,
        },
      ],

      search: {
        term: 'budget',
        targets: ['title', 'description', 'documentNumber'],
      },
    });
  });

  it('keeps repeated filters for the same field when operators differ', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'processingDays',
          operator: 'gte',
          value: 5,
        },

        {
          field: 'processingDays',
          operator: 'lte',
          value: 30,
        },
      ],
    });

    const result = resolveDataTableQuery(testPolicy, query);

    expect(result.filters).toHaveLength(2);

    expect(result.filters[0]).toEqual({
      field: 'processingDays',
      target: 'processingDays',
      operator: 'gte',
      value: 5,
    });

    expect(result.filters[1]).toEqual({
      field: 'processingDays',
      target: 'processingDays',
      operator: 'lte',
      value: 30,
    });
  });

  it('maps public resource fields to internal targets', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'office',
          direction: 'desc',
        },
      ],

      filters: [
        {
          field: 'enabled',
          operator: 'equals',
          value: true,
        },
      ],
    });

    const result = resolveDataTableQuery(testPolicy, query);

    expect(result.sorting[0]?.target).toBe('officeName');

    expect(result.filters[0]?.target).toBe('isEnabled');
  });

  it('rejects an unknown sorting field', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'passwordHash',
          direction: 'asc',
        },
      ],
    });

    expect(() => resolveDataTableQuery(testPolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(testPolicy, query);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DataTableQueryPolicyError);

      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('UNKNOWN_SORT_FIELD');

        expect(error.field).toBe('passwordHash');
      }
    }
  });

  it('rejects an unknown filtering field', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'passwordHash',
          operator: 'contains',
          value: 'secret',
        },
      ],
    });

    expect(() => resolveDataTableQuery(testPolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(testPolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('UNKNOWN_FILTER_FIELD');

        expect(error.field).toBe('passwordHash');
      }
    }
  });

  it('rejects an operator that the field does not allow', () => {
    /**
     * Structurally valid:
     *
     * contains + string
     *
     * But resource policy allows status only:
     *
     * equals | in
     */
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'status',
          operator: 'contains',
          value: 'ACT',
        },
      ],
    });

    expect(() => resolveDataTableQuery(testPolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(testPolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('FILTER_OPERATOR_NOT_ALLOWED');

        expect(error.field).toBe('status');

        expect(error.operator).toBe('contains');
      }
    }
  });

  it('uses only server-owned global search targets', () => {
    const query = dataTableQuerySchema.parse({
      search: {
        term: 'aspirin',
      },
    });

    const result = resolveDataTableQuery(testPolicy, query);

    expect(result.search).toEqual({
      term: 'aspirin',
      targets: ['title', 'description', 'documentNumber'],
    });
  });

  it('rejects global search when the resource does not expose it', () => {
    const policyWithoutSearch = createDataTableQueryPolicy({
      sorting: {},
      filtering: {},
    });

    const query = dataTableQuerySchema.parse({
      search: {
        term: 'aspirin',
      },
    });

    expect(() => resolveDataTableQuery(policyWithoutSearch, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(policyWithoutSearch, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('GLOBAL_SEARCH_NOT_ALLOWED');
      }
    }
  });

  it('does not resolve inherited Object prototype properties as policy fields', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'constructor',
          direction: 'asc',
        },
      ],
    });

    expect(() => resolveDataTableQuery(testPolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(testPolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('UNKNOWN_SORT_FIELD');
      }
    }
  });

  it('returns no search property when no global search was requested', () => {
    const query = dataTableQuerySchema.parse({
      page: 1,
      pageSize: 25,
    });

    const result = resolveDataTableQuery(testPolicy, query);

    expect(result.search).toBeUndefined();

    expect(Object.prototype.hasOwnProperty.call(result, 'search')).toBe(false);
  });
});

describe('createDataTableQueryPolicy', () => {
  it('rejects an empty sorting target', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {
          title: {
            target: '',
          },
        },

        filtering: {},
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });

  it('rejects an empty filter target', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {},

        filtering: {
          status: {
            target: '   ',
            operators: ['equals'],
          },
        },
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });

  it('rejects a filter field with no allowed operators', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {},

        filtering: {
          status: {
            target: 'status',
            operators: [],
          },
        },
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });

  it('rejects duplicate filter operators', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {},

        filtering: {
          status: {
            target: 'status',
            operators: ['equals', 'equals'],
          },
        },
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });

  it('rejects duplicate search targets', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {},
        filtering: {},
        search: {
          targets: ['title', 'title'],
        },
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });

  it('rejects an empty search target', () => {
    expect(() =>
      createDataTableQueryPolicy({
        sorting: {},
        filtering: {},
        search: {
          targets: ['title', ' '],
        },
      }),
    ).toThrow(DataTableQueryPolicyConfigurationError);
  });
});

/**
 * Policy demonstrating resource-specific value validation.
 */
const typedValuePolicy = createDataTableQueryPolicy({
  sorting: {},
  filtering: {
    categoryId: {
      target: 'categoryId',
      operators: ['equals', 'in'],
      values: {
        equals: z.number().int().positive(),
        in: z.array(z.number().int().positive()).min(1),
      },
    },
    key: {
      target: 'key',
      operators: ['equals', 'contains'],
      values: {
        equals: z.string().trim().min(1),
        contains: z.string().trim().min(1),
      },
    },
  },
});

describe('resolveDataTableQuery', () => {
  // Test cases for the resolveDataTableQuery function with the typed value policy
  it('applies resource-specific filter value parsing and transformation', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'key',
          operator: 'equals',

          /**
           * Generic equals validation intentionally does not trim
           * strings.
           *
           * The resource-specific parser does.
           */
          value: '   auth.login   ',
        },
      ],
    });

    const result = resolveDataTableQuery(typedValuePolicy, query);

    expect(result.filters[0]).toEqual({
      field: 'key',
      target: 'key',
      operator: 'equals',
      value: 'auth.login',
    });
  });

  it('rejects a structurally valid value that is invalid for the resource field', () => {
    /**
     * Generic equals accepts strings.
     *
     * But this resource declares:
     *
     *   categoryId equals -> positive integer
     */
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'categoryId',
          operator: 'equals',
          value: 'not-a-number',
        },
      ],
    });

    expect(() => resolveDataTableQuery(typedValuePolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(typedValuePolicy, query);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DataTableQueryPolicyError);

      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('INVALID_FILTER_VALUE');
        expect(error.field).toBe('categoryId');
        expect(error.operator).toBe('equals');
        expect(error.cause).toBeDefined();
      }
    }
  });

  it('rejects an in-filter containing values invalid for the resource field', () => {
    /**
     * Generic `in` accepts scalar arrays:
     *
     *   string[]
     *   number[]
     *   boolean[]
     *
     * But categoryId is explicitly:
     *
     *   positive integer[]
     */
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'categoryId',
          operator: 'in',
          value: [1, 2, 'invalid'],
        },
      ],
    });

    expect(() => resolveDataTableQuery(typedValuePolicy, query)).toThrow(
      DataTableQueryPolicyError,
    );

    try {
      resolveDataTableQuery(typedValuePolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('INVALID_FILTER_VALUE');
        expect(error.field).toBe('categoryId');
        expect(error.operator).toBe('in');
      }
    }
  });
});
