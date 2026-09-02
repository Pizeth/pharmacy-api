// src/common/data-table/http/resolve-data-table-query-for-http.spec.ts

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import {
  createDataTableQueryPolicy,
  dataTableQuerySchema,
} from 'common/data-table';
import { resolveDataTableQueryForHttp } from './resolve-data-table-query-for-http';

/**
 * Small resource policy used exclusively to test the HTTP boundary.
 */
const testPolicy = createDataTableQueryPolicy({
  sorting: {
    name: {
      target: 'name',
    },
  },

  filtering: {
    categoryId: {
      target: 'categoryId',
      operators: ['equals'],

      values: {
        equals: z.number().int().positive(),
      },
    },

    name: {
      target: 'name',
      operators: ['equals', 'contains'],
    },
  },

  search: {
    targets: ['name'],
  },
});

describe('resolveDataTableQueryForHttp', () => {
  it('returns a resolved query when the resource request is valid', () => {
    const query = dataTableQuerySchema.parse({
      page: 2,
      pageSize: 25,

      sorting: [
        {
          field: 'name',
          direction: 'asc',
        },
      ],

      filters: [
        {
          field: 'categoryId',
          operator: 'equals',
          value: 7,
        },
      ],

      search: {
        term: 'login',
      },
    });

    const result = resolveDataTableQueryForHttp(testPolicy, query);

    expect(result.page).toBe(2);

    expect(result.pageSize).toBe(25);

    expect(result.sorting).toEqual([
      {
        field: 'name',
        target: 'name',
        direction: 'asc',
      },
    ]);

    expect(result.filters).toEqual([
      {
        field: 'categoryId',
        target: 'categoryId',
        operator: 'equals',
        value: 7,
      },
    ]);

    expect(result.search).toEqual({
      term: 'login',
      targets: ['name'],
    });
  });

  it('converts an unknown resource field into BadRequestException', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'notAllowed',
          direction: 'asc',
        },
      ],
    });

    let captured: unknown;

    try {
      resolveDataTableQueryForHttp(testPolicy, query);
    } catch (error: unknown) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(BadRequestException);

    if (captured instanceof BadRequestException) {
      expect(captured.getStatus()).toBe(400);

      expect(captured.getResponse()).toEqual(
        expect.objectContaining({
          code: 'UNKNOWN_SORT_FIELD',
          field: 'notAllowed',
        }),
      );
    }
  });

  it('converts an invalid resource-specific filter value into BadRequestException', () => {
    /**
     * Generic `equals` accepts a string.
     *
     * Therefore the transport-level schema accepts this request.
     *
     * The resource policy then rejects it because categoryId
     * specifically requires a positive integer.
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

    let captured: unknown;

    try {
      resolveDataTableQueryForHttp(testPolicy, query);
    } catch (error: unknown) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(BadRequestException);

    if (captured instanceof BadRequestException) {
      expect(captured.getStatus()).toBe(400);

      expect(captured.getResponse()).toEqual(
        expect.objectContaining({
          code: 'INVALID_FILTER_VALUE',
          field: 'categoryId',
          operator: 'equals',
        }),
      );
    }
  });
});
