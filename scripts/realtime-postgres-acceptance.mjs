// Explicit opt-in only. Never reads DATABASE_URL or production .env files.
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { finishPostgresAcceptance } from './realtime-postgres-cleanup.mjs';

const url = process.env.REALTIME_TEST_DATABASE_URL;
if (!url) {
  console.error(
    'BLOCKED: set REALTIME_TEST_DATABASE_URL to a disposable PostgreSQL database.',
  );
  process.exitCode = 2;
} else {
  const suffix = randomUUID().replaceAll('-', '');
  const schema = `live_test_${suffix}`,
    channel = `live_${suffix}`;
  const config = {
    connectionString: url,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
  };
  const writer = new Client(config);
  const a = new Client(config),
    b = new Client(config);
  let schemaCreated = false;
  let failure;
  const receivedA = [],
    receivedB = [];
  const wait = async (predicate) => {
    const until = Date.now() + 3000;
    while (!predicate()) {
      if (Date.now() > until) throw new Error('Notification deadline exceeded');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  try {
    // Wait for every connect attempt before cleanup; one early rejection must
    // not strand another client's still-opening socket.
    const connections = await Promise.allSettled([
      writer.connect(),
      a.connect(),
      b.connect(),
    ]);
    const failed = connections.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    await writer.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    // Minimal disposable relations; production data and schema are untouched.
    await writer.query(`CREATE TABLE ${schema}.translation_keys (id int PRIMARY KEY, key text);
      CREATE TABLE ${schema}.translations (id int PRIMARY KEY, key_id int, value text);
      CREATE TABLE ${schema}.translation_category (id int PRIMARY KEY, name text);`);
    const migration = await readFile(
      new URL(
        '../prisma/migrations/20261102000100_translation_realtime/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await writer.query(
      migration
        .replaceAll('public.', `${schema}.`)
        .replaceAll('pg_catalog, public', `pg_catalog, ${schema}`)
        .replaceAll('datatable_live_v1', channel),
    );
    a.on('notification', (message) =>
      receivedA.push(JSON.parse(message.payload)),
    );
    b.on('notification', (message) =>
      receivedB.push(JSON.parse(message.payload)),
    );
    await Promise.all([
      a.query(`LISTEN ${channel}`),
      b.query(`LISTEN ${channel}`),
    ]);
    await writer.query('BEGIN');
    await writer.query(
      `INSERT INTO ${schema}.translation_keys VALUES (1, 'disposable')`,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(receivedA.length, 0, 'uncommitted data must not notify');
    await writer.query('ROLLBACK');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(receivedA.length, 0, 'rollback must not notify');
    await writer.query(
      `INSERT INTO ${schema}.translation_keys VALUES (1, 'disposable')`,
    );
    await wait(() => receivedA.length === 1 && receivedB.length === 1);
    assert.equal(receivedA[0].type, 'created');
    assert.equal(receivedA[0].recordId, '1');
    assert.equal(receivedA[0].eventId, receivedB[0].eventId);
    await writer.query(`INSERT INTO ${schema}.translations VALUES (10, 1, 'secret never sent');
      UPDATE ${schema}.translation_keys SET key = 'changed' WHERE id = 1;
      DELETE FROM ${schema}.translation_keys WHERE id = 1;
      INSERT INTO ${schema}.translation_category VALUES (1, 'category');`);
    await wait(() => receivedA.length === 5 && receivedB.length === 5);
    assert.deepEqual(
      receivedA.map((event) => event.type),
      ['created', 'updated', 'updated', 'deleted', 'invalidate'],
    );
    assert.equal(JSON.stringify(receivedA).includes('secret'), false);
    assert.equal(new Set(receivedA.map((event) => event.eventId)).size, 5);
  } catch (error) {
    failure = { error };
  } finally {
    await finishPostgresAcceptance({
      writer,
      clients: [a, b, writer],
      schema,
      schemaCreated,
      failure,
    });
  }
  console.log(
    'PASS: two independent PostgreSQL listeners, commit/rollback, key/value/category events and identity-only payloads.',
  );
  console.log('Disposable acceptance schema removed and clients closed.');
  console.log(
    'This is a database delivery proof, not authenticated browser cross-client acceptance.',
  );
}
