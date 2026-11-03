import assert from 'node:assert/strict';

/** Compare direct/pooler aliases for the same Supabase project as one database. */
function databaseIdentity(value) {
  const parsed = new URL(value);
  assert(
    ['postgres:', 'postgresql:'].includes(parsed.protocol),
    'Expected a PostgreSQL URL.',
  );
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(parsed.hostname);
  const pooler = parsed.hostname.endsWith('.pooler.supabase.com');
  const project =
    direct?.[1] ??
    (pooler
      ? decodeURIComponent(parsed.username).split('.').at(-1)
      : undefined);
  return {
    parsed,
    key: project
      ? `supabase:${project}${parsed.pathname}`
      : `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`,
  };
}

/** @param {Record<string, string | undefined>} env @returns {string} */
export function getRealtimeTestDatabaseUrl(env) {
  const value = env.REALTIME_TEST_DATABASE_URL;
  assert(
    value,
    'Explicit REALTIME_TEST_DATABASE_URL is required; no DATABASE_URL fallback.',
  );
  const test = databaseIdentity(value);
  assert(
    !(
      test.parsed.hostname.endsWith('.pooler.supabase.com') &&
      test.parsed.port === '6543'
    ),
    'LISTEN requires session pooling, not transaction pooling.',
  );
  for (const application of [env.DATABASE_URL, env.DIRECT_URL]) {
    assert(
      !application || databaseIdentity(application).key !== test.key,
      'Test and application database identities must differ.',
    );
  }
  return value;
}
