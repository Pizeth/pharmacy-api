// src/common/data-table/schemas/data-table-query.schema.spec.ts

import {
  DATA_TABLE_MAX_PAGE_SIZE,
  dataTableQuerySchema,
} from './data-table-query.schema';

describe('dataTableQuerySchema', () => {
  it('applies the default pagination and empty query state', () => {
    const result = dataTableQuerySchema.parse({});

    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      sorting: [],
      filters: [],
    });
  });

  it('accepts a complete valid DataTable request', () => {
    const result = dataTableQuerySchema.parse({
      page: 3,
      pageSize: 100,
      sorting: [
        {
          field: 'title',
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

    expect(result.page).toBe(3);

    expect(result.pageSize).toBe(100);

    expect(result.sorting).toHaveLength(1);

    expect(result.filters).toHaveLength(3);

    expect(result.search).toEqual({
      term: 'budget',
    });
  });

  it('coerces page and pageSize when supplied as strings', () => {
    const result = dataTableQuerySchema.parse({
      page: '2',

      pageSize: '50',
    });

    expect(result.page).toBe(2);

    expect(result.pageSize).toBe(50);
  });

  it('trims the global search term', () => {
    const result = dataTableQuerySchema.parse({
      search: {
        term: '   aspirin   ',
      },
    });

    expect(result.search?.term).toBe('aspirin');
  });

  it('rejects unknown top-level properties', () => {
    const result = dataTableQuerySchema.safeParse({
      page: 1,

      secret: 'should-not-pass',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown properties inside a sort descriptor', () => {
    const result = dataTableQuerySchema.safeParse({
      sorting: [
        {
          field: 'title',
          direction: 'asc',
          unsafe: true,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects page zero', () => {
    const result = dataTableQuerySchema.safeParse({
      page: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects page sizes above the server limit', () => {
    const result = dataTableQuerySchema.safeParse({
      pageSize: DATA_TABLE_MAX_PAGE_SIZE + 1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects numeric values for contains filters', () => {
    const result = dataTableQuerySchema.safeParse({
      filters: [
        {
          field: 'title',
          operator: 'contains',
          value: 123,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects string values for numeric gte filters', () => {
    const result = dataTableQuerySchema.safeParse({
      filters: [
        {
          field: 'processingDays',
          operator: 'gte',
          value: '10',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty in-filter', () => {
    const result = dataTableQuerySchema.safeParse({
      filters: [
        {
          field: 'status',
          operator: 'in',
          value: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a non-empty scalar in-filter', () => {
    const result = dataTableQuerySchema.safeParse({
      filters: [
        {
          field: 'status',
          operator: 'in',
          value: ['ACTIVE', 'INACTIVE'],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects browser-supplied global-search fields', () => {
    const result = dataTableQuerySchema.safeParse({
      search: {
        term: 'admin',
        fields: ['passwordHash'],
      },
    });

    expect(result.success).toBe(false);
  });
});
