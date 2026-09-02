// src/modules/i18n/data-table/translation-key-data-table.policy.spec.ts

import {
  DataTableQueryPolicyError,
  dataTableQuerySchema,
  resolveDataTableQuery,
} from 'common/data-table';
import { translationKeyDataTablePolicy } from './translation-key-data-table.policy';

describe('translationKeyDataTablePolicy', () => {
  it('maps public category fields to the trusted categoryName target', () => {
    const query = dataTableQuerySchema.parse({
      sorting: [
        {
          field: 'category',
          direction: 'asc',
        },
      ],

      filters: [
        {
          field: 'category',
          operator: 'contains',
          value: 'auth',
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    expect(resolved.sorting[0]).toEqual({
      field: 'category',
      target: 'categoryName',
      direction: 'asc',
    });

    expect(resolved.filters[0]).toEqual({
      field: 'category',
      target: 'categoryName',
      operator: 'contains',
      value: 'auth',
    });
  });

  it('rejects a string categoryId even though generic equals accepts strings', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'categoryId',
          operator: 'equals',
          value: 'auth',
        },
      ],
    });

    expect(() =>
      resolveDataTableQuery(translationKeyDataTablePolicy, query),
    ).toThrow(DataTableQueryPolicyError);

    try {
      resolveDataTableQuery(translationKeyDataTablePolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('INVALID_FILTER_VALUE');
        expect(error.field).toBe('categoryId');
        expect(error.operator).toBe('equals');
      }
    }
  });

  it('trims locale filter values through resource parsing', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'locale',
          operator: 'equals',
          value: '  km  ',
        },
      ],
    });

    const resolved = resolveDataTableQuery(
      translationKeyDataTablePolicy,
      query,
    );

    expect(resolved.filters[0]).toEqual({
      field: 'locale',
      target: 'translationLocale',
      operator: 'equals',
      value: 'km',
    });
  });

  it('rejects non-string locale values inside an in filter', () => {
    const query = dataTableQuerySchema.parse({
      filters: [
        {
          field: 'locale',
          operator: 'in',
          value: ['en', 'km', 123],
        },
      ],
    });

    expect(() =>
      resolveDataTableQuery(translationKeyDataTablePolicy, query),
    ).toThrow(DataTableQueryPolicyError);

    try {
      resolveDataTableQuery(translationKeyDataTablePolicy, query);
    } catch (error: unknown) {
      if (error instanceof DataTableQueryPolicyError) {
        expect(error.code).toBe('INVALID_FILTER_VALUE');
        expect(error.field).toBe('locale');
        expect(error.operator).toBe('in');
      }
    }
  });
});
