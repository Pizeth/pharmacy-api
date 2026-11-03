import { getRealtimeTestDatabaseUrl } from '../../../scripts/realtime-test-database.mjs';

it('never falls back to an application database', () => {
  expect(() =>
    getRealtimeTestDatabaseUrl({
      DATABASE_URL: 'postgres://user@localhost/app',
    }),
  ).toThrow('Explicit');
});

it('rejects direct/session/transaction aliases for the same Supabase project', () => {
  expect(() =>
    getRealtimeTestDatabaseUrl({
      REALTIME_TEST_DATABASE_URL:
        'postgres://postgres.sameproject@aws-1.pooler.supabase.com:5432/postgres',
      DATABASE_URL:
        'postgres://postgres@db.sameproject.supabase.co:5432/postgres',
    }),
  ).toThrow('identities must differ');
});

it('rejects transaction pooling for the test listener', () => {
  expect(() =>
    getRealtimeTestDatabaseUrl({
      REALTIME_TEST_DATABASE_URL:
        'postgres://postgres.testproject@aws-1.pooler.supabase.com:6543/postgres',
    }),
  ).toThrow('session pooling');
});

it('rejects the same generic database under a different user', () => {
  expect(() =>
    getRealtimeTestDatabaseUrl({
      REALTIME_TEST_DATABASE_URL: 'postgres://tester@localhost/app',
      DIRECT_URL: 'postgres://owner@localhost:5432/app',
    }),
  ).toThrow('identities must differ');
});

it('accepts an explicit separate test project without exposing its credentials', () => {
  const value =
    'postgres://postgres.testproject@aws-1.pooler.supabase.com:5432/postgres';
  expect(
    getRealtimeTestDatabaseUrl({
      REALTIME_TEST_DATABASE_URL: value,
      DATABASE_URL:
        'postgres://postgres.production@aws-1.pooler.supabase.com:6543/postgres',
    }),
  ).toBe(value);
});
