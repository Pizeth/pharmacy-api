import { dataTableQuerySchema } from 'common/data-table';
import { resolveDataTableQueryForHttp } from 'common/data-table/http';
import {
  userDataTablePolicy,
  userDataTableTranslator,
} from './user-data-table';
it('combines name, role and active-status filters with search and pagination', () => {
  const query = dataTableQuerySchema.parse({
    page: 2,
    pageSize: 25,
    filters: [
      { field: 'name', operator: 'contains', value: 'Jane' },
      { field: 'role', operator: 'equals', value: 2 },
      { field: 'banned', operator: 'equals', value: false },
    ],
    search: { term: 'example.com' },
  });
  const result = userDataTableTranslator.translate(
    resolveDataTableQueryForHttp(userDataTablePolicy, query),
  );
  expect(result.skip).toBe(25);
  expect(result.take).toBe(25);
  const where = JSON.stringify(result.where);
  expect(where).toContain('"roleId":2');
  expect(where).toContain('"banned":false');
  expect(where).toContain('"banned":null');
  expect(where).toContain('example.com');
  expect(where).toContain('Jane');
});
it('rejects fields and operators outside the user query policy', () => {
  expect(() =>
    resolveDataTableQueryForHttp(
      userDataTablePolicy,
      dataTableQuerySchema.parse({
        filters: [{ field: 'password', operator: 'contains', value: 'secret' }],
      }),
    ),
  ).toThrow();
  expect(() =>
    resolveDataTableQueryForHttp(
      userDataTablePolicy,
      dataTableQuerySchema.parse({
        filters: [{ field: 'role', operator: 'equals', value: 'admin' }],
      }),
    ),
  ).toThrow();
});
