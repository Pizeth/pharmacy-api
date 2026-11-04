/** Opt-in real HTTP/session/database proof. Never imports dotenv or seeds/resets. */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import {
  Module,
  StandardSchemaValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AuthModule, AuthService } from '@thallesp/nestjs-better-auth';
import { serializeSignedCookie } from 'better-call';
import { betterAuth } from 'better-auth';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/modules/prisma/services/prisma.service';
import { CaslAbilityFactory } from '../src/modules/authorization/casl/casl-ability.factory';
import { PoliciesGuard } from '../src/modules/authorization/guards/policies.guard';
import { RealtimeAccess } from '../src/modules/realtime/realtime-access.service';
import { RealtimeBus } from '../src/modules/realtime/realtime-bus.service';
import { RealtimeController } from '../src/modules/realtime/realtime.controller';
import { I18nAdminController } from '../src/modules/i18n/controllers/i18n-admin.controller';
import { I18nService } from '../src/modules/i18n/services/i18n.service';
import { DBHelper } from '../src/modules/helpers/services/db-helper';
import {
  parseRealtimeEvent,
  type RealtimeEvent,
} from '../src/modules/realtime/realtime.contract';
import { getRealtimeTestDatabaseUrl } from './realtime-test-database.mjs';
import { TransformInterceptor } from '../src/interceptors/transform.interceptor';
import type { Request, Response } from 'express';

const url = getRealtimeTestDatabaseUrl(process.env);
// These are local process settings only. No production configuration is changed.
process.env.REALTIME_ENABLED = 'true';
process.env.REALTIME_DATABASE_URL = url;
process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID();
process.env.BETTER_AUTH_URL = 'http://localhost:8082';
process.env.FRONTEND_URL = 'http://localhost:8082';
process.env.CORS_ORIGINS = 'http://localhost:8082';
// Acceptance must not call hosted fraud/analytics services with injected keys.
delete process.env.BETTER_AUTH_API_KEY;
delete process.env.BETTER_AUTH_IDENTIFY_URL;
delete process.env.BETTER_AUTH_KV_URL;
const { options } = await import('../src/lib/auth');

const admin = new Client({
  connectionString: url,
  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    query_timeout: 15000,
    max: 4,
  }),
});
const db = prisma as PrismaService;
const prefix = `live_accept_${randomUUID().replaceAll('-', '')}`;
const userIds: number[] = [],
  roleIds: number[] = [],
  permissionIds: number[] = [];
let categoryId: number | undefined;
let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
const controllers: AbortController[] = [];
const browser = process.env.REALTIME_TEST_BROWSER_BUNDLE;
let finishBrowser: (() => void) | undefined;
let failure: unknown;
let baseline: number[] | undefined;
let fixturesStarted = false;
let databaseError: Error | undefined;
admin.on('error', (error) => {
  databaseError ??= error;
});

const readBaseline = () =>
  Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.translationKey.count(),
    prisma.translationCategory.count(),
    prisma.translation.count(),
    prisma.session.count(),
  ]);

async function until(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 12000;
  while (!predicate()) {
    if (databaseError) throw databaseError;
    assert(Date.now() < deadline, `Deadline: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

try {
  await admin.connect();
  // One acceptance run owns fixture provisioning. Existing application data is never reset.
  assert(
    (await admin.query('SELECT pg_try_advisory_lock(723206, 1) AS locked'))
      .rows[0].locked,
    'Another acceptance run is active.',
  );
  const tables = await admin.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  if (!tables.rowCount) {
    assert(
      process.env.REALTIME_TEST_ALLOW_SCHEMA_SETUP === 'true',
      'Empty test database: explicitly allow schema setup.',
    );
    const sql = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    await admin.query('BEGIN');
    try {
      await admin.query(sql);
      // No anonymous access to disposable application data through Supabase Data API.
      const names = await admin.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      for (const { tablename } of names.rows) {
        await admin.query(
          `ALTER TABLE public."${tablename.replaceAll('"', '""')}" ENABLE ROW LEVEL SECURITY`,
        );
      }
      await admin.query(
        await readFile(
          'prisma/migrations/20261102000100_translation_realtime/migration.sql',
          'utf8',
        ),
      );
      await admin.query('COMMIT');
      console.log(
        'Provisioned empty test database from current Prisma schema; no reset or seed.',
      );
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
  }

  baseline = await readBaseline();
  assert(
    !browser || baseline.every((count) => count === 0),
    'The browser fixture requires an empty disposable application database.',
  );
  fixturesStarted = true;
  const grants = [
    ...['read', 'create', 'update', 'delete'].map((action) => ({
      action,
      subject: 'TranslationKey',
    })),
    { action: 'read', subject: 'TranslationCategory' },
  ];
  for (const grant of grants) {
    const existing = await prisma.permission.findUnique({
      where: { action_subject: grant },
    });
    if (!existing)
      permissionIds.push(
        (
          await prisma.permission.create({
            data: grant,
          })
        ).id,
      );
  }
  const permissions = await prisma.permission.findMany({
    where: { OR: grants },
  });
  const readId = permissions.find(
    (p) => p.action === 'read' && p.subject === 'TranslationKey',
  )!.id;
  const makeActor = async (name: string, allowed = true) => {
    const role = await prisma.role.create({
      data: {
        name: `${prefix.slice(0, 38)}_${name}`,
        createdBy: 0,
        updatedBy: 0,
        permissions: {
          create: allowed
            ? permissions.map((p) => ({ permissionId: p.id }))
            : [],
        },
      },
    });
    roleIds.push(role.id);
    const user = await prisma.user.create({
      data: {
        name: `Acceptance ${name}`,
        email: `${prefix}_${name}@example.invalid`,
        roleId: role.id,
        isEnabled: true,
        isActivated: true,
        isLocked: false,
        emailVerified: true,
      },
    });
    userIds.push(user.id);
    const token = randomUUID();
    await prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return { user, role, token };
  };
  const a = await makeActor('a'),
    b = await makeActor('b'),
    denied = await makeActor('denied', false);
  categoryId = (
    await prisma.translationCategory.create({ data: { name: prefix } })
  ).id;
  // Keep application session/adapter/plugins; omit hosted integrations and JWT issuance.
  // Realtime uses database-backed cookies, not JWTs. Random test signing secrets must
  // not create persistent JWKS or depend on keys from another acceptance run.
  const configuration = options(prisma, {} as Parameters<typeof options>[1]);
  const auth = betterAuth({
    ...configuration,
    advanced: { ...configuration.advanced, cookiePrefix: prefix },
    plugins: configuration.plugins.filter(
      (plugin) => !['dash', 'sentinel', 'jwt'].includes(plugin.id),
    ),
  });
  const context = await auth.$context;
  const cookie = async (token: string) =>
    (
      await serializeSignedCookie(
        context.authCookies.sessionToken.name,
        token,
        context.secret,
      )
    ).split(';')[0];
  const cookieA = await cookie(a.token),
    cookieB = await cookie(b.token),
    cookieDenied = await cookie(denied.token);
  const abilities = new CaslAbilityFactory(db);
  // tsx does not emit decorator parameter metadata. Explicit DI preserves the real implementations.
  Reflect.defineMetadata(
    'design:paramtypes',
    [RealtimeBus, RealtimeAccess],
    RealtimeController,
  );
  Reflect.defineMetadata(
    'design:paramtypes',
    [I18nService],
    I18nAdminController,
  );
  Reflect.defineMetadata(
    'design:paramtypes',
    [Reflector, CaslAbilityFactory],
    PoliciesGuard,
  );
  @Module({
    imports: [AuthModule.forRoot({ auth, disableControllers: true })],
    controllers: [RealtimeController, I18nAdminController],
    providers: [
      RealtimeBus,
      { provide: CaslAbilityFactory, useValue: abilities },
      PoliciesGuard,
      {
        provide: RealtimeAccess,
        inject: [AuthService],
        useFactory: (service: AuthService<typeof auth>) =>
          new RealtimeAccess(service, abilities),
      },
      { provide: I18nService, useValue: new I18nService(db, new DBHelper(db)) },
    ],
  })
  class AcceptanceModule {}
  app = await NestFactory.create(AcceptanceModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  if (browser) {
    const bundle = await readFile(browser, 'utf8');
    const express = app.getHttpAdapter();
    // Test-only loopback fixture: never part of AppModule or the runtime image.
    // Distinct hosts give each browser tab an independent cookie jar.
    express.get(
      '/acceptance/session/:actor',
      async (req: Request, res: Response) => {
        const credential =
          req.params.actor === 'a'
            ? cookieA
            : req.params.actor === 'b'
              ? cookieB
              : undefined;
        if (!credential) {
          res.sendStatus(404);
          return;
        }
        res.setHeader(
          'Set-Cookie',
          `${credential}; Path=/; HttpOnly; SameSite=Lax; Secure`,
        );
        res.redirect('/acceptance');
      },
    );
    express.get('/acceptance/bundle.js', (_req: Request, res: Response) => {
      res.type('js').send(bundle);
    });
    express.get('/acceptance', (_req: Request, res: Response) => {
      res
        .type('html')
        .send(
          '<!doctype html><html lang="en"><title>Authenticated realtime acceptance</title><div id="root"></div><script src="/acceptance/bundle.js"></script></html>',
        );
    });
    express.post('/acceptance/finish', async (req: Request, res: Response) => {
      try {
        await app!.get(RealtimeAccess).assertRead(req.headers);
      } catch {
        res.sendStatus(403);
        return;
      }
      res.sendStatus(200);
      finishBrowser?.();
    });
    process.env.CORS_ORIGINS = 'http://localhost:8082,http://127.0.0.1:8082';
  }
  await app.listen(browser ? 8082 : 0, '127.0.0.1');
  assert(app.get(RealtimeBus).ready, 'Real database listener must be ready.');
  const base = await app.getUrl();
  const endpoint = `${base}/api/v1/live/translations`;
  const request = (path: string, method: string, body?: unknown) =>
    fetch(`${base}/api/v1/i18n/${path}`, {
      method,
      headers: { Cookie: cookieA, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  const status = async (credentials?: string, origin?: string) => {
    const response = await fetch(endpoint, {
      headers: {
        ...(credentials ? { Cookie: credentials } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      signal: AbortSignal.timeout(12000),
    });
    await response.body?.cancel();
    return response.status;
  };
  assert.equal(await status(), 401);
  assert.equal(await status(await cookie('invalid-session')), 401);
  assert.equal(await status(cookieDenied), 403);
  assert.equal(await status(cookieA, 'https://untrusted.example'), 403);
  assert.equal((await request('categories', 'GET')).status, 200);
  for (const data of [
    { isEnabled: false },
    { isLocked: true },
    { isActivated: false },
  ]) {
    await prisma.user.update({
      where: { id: denied.user.id },
      data: { roleId: a.role.id, ...data },
    });
    assert.equal(await status(cookieDenied), 403);
    await prisma.user.update({
      where: { id: denied.user.id },
      data: { isEnabled: true, isLocked: false, isActivated: true },
    });
  }
  await prisma.rolePermission.create({
    data: { roleId: denied.role.id, permissionId: readId },
  });
  await prisma.role.update({
    where: { id: denied.role.id },
    data: { isEnabled: false },
  });
  await prisma.user.update({
    where: { id: denied.user.id },
    data: { roleId: denied.role.id },
  });
  assert.equal(await status(cookieDenied), 403);

  async function open(credentials: string) {
    const controller = new AbortController();
    controllers.push(controller);
    const opening = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(endpoint, {
      headers: { Cookie: credentials },
      signal: controller.signal,
    }).finally(() => clearTimeout(opening));
    assert.equal(response.status, 200);
    assert(response.body);
    const events: RealtimeEvent[] = [];
    let closed = false,
      streamError: unknown;
    const completion = (async () => {
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const frame = await reader.read();
          if (frame.done) break;
          buffer += decoder.decode(frame.value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const raw = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            for (const line of raw.split('\n'))
              if (line.startsWith('data: ')) {
                const event = parseRealtimeEvent(line.slice(6));
                assert(event, 'Invalid protected event');
                events.push(event);
              }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) streamError = error;
      } finally {
        closed = true;
        reader.releaseLock();
      }
    })();
    await until(
      () => events.some((e) => e.type === 'invalidate'),
      'initial authenticated resync',
    );
    return {
      events,
      completion,
      closed: () => closed,
      assertHealthy: () => {
        if (streamError) throw streamError;
      },
    };
  }
  const streamA = await open(cookieA),
    streamB = await open(cookieB);
  const created = await request('keys', 'POST', {
    key: prefix,
    description: 'Private acceptance text',
    categoryId,
  });
  assert.equal(created.status, 201);
  const key = ((await created.json()) as { data: { id: number } }).data;
  assert(Number.isSafeInteger(key.id));
  const expectBoth = async (type: string, afterA = 0, afterB = 0) => {
    const matches = (event: RealtimeEvent) =>
      event.type === type && event.recordId === String(key.id);
    await until(
      () =>
        streamA.events
          .slice(afterA)
          .some(
            (event) =>
              matches(event) &&
              streamB.events
                .slice(afterB)
                .some(
                  (other) => matches(other) && other.eventId === event.eventId,
                ),
          ),
      `same ${type} event reaches both sessions`,
    );
    streamA.assertHealthy();
    streamB.assertHealthy();
  };
  await expectBoth('created');
  const offsetA = streamA.events.length;
  const offsetB = streamB.events.length;
  assert.equal(
    (
      await request(`keys/${key.id}`, 'PATCH', {
        description: 'Updated privately',
      })
    ).status,
    200,
  );
  await expectBoth('updated', offsetA, offsetB);
  const result = await request('keys/query', 'POST', {
    page: 1,
    pageSize: 25,
    search: { term: prefix },
  });
  assert.equal(result.status, 200);
  assert(
    JSON.stringify(await result.json()).includes('Updated privately'),
    'Canonical HTTP refetch must expose committed content.',
  );
  await prisma.rolePermission.delete({
    where: { roleId_permissionId: { roleId: b.role.id, permissionId: readId } },
  });
  const countB = streamB.events.length,
    countA = streamA.events.length;
  assert.equal(
    (
      await request(`keys/${key.id}`, 'PATCH', {
        description: 'Revoked session must not receive this',
      })
    ).status,
    200,
  );
  await until(
    () => streamB.closed(),
    'revoked permission closes existing session',
  );
  assert.equal(
    streamB.events.length,
    countB,
    'Revoked reader must receive no further event.',
  );
  await until(
    () => streamA.events.length > countA,
    'remaining authorized reader continues',
  );
  assert.equal(await status(cookieB), 403);
  const beforeDisable = streamA.events.length;
  await prisma.user.update({
    where: { id: a.user.id },
    data: { isEnabled: false },
  });
  await prisma.translationKey.update({
    where: { id: key.id },
    data: { description: 'Disabled account must not receive this' },
  });
  await until(
    () => streamA.closed(),
    'disabled account closes existing session',
  );
  assert.equal(
    streamA.events.length,
    beforeDisable,
    'Disabled account must receive no further event.',
  );
  assert.equal(await status(cookieA), 403);
  await prisma.user.update({
    where: { id: a.user.id },
    data: { isEnabled: true },
  });
  const reconnected = await open(cookieA);
  assert.equal((await request(`keys/${key.id}`, 'DELETE')).status, 200);
  await until(
    () =>
      reconnected.events.some(
        (e) => e.type === 'deleted' && e.recordId === String(key.id),
      ),
    'reconnected session receives deletion',
  );
  await prisma.session.delete({ where: { token: a.token } });
  await prisma.translationCategory.update({
    where: { id: categoryId },
    data: { description: 'Session revoked' },
  });
  await until(
    () => reconnected.closed(),
    'deleted session closes existing stream',
  );
  assert.equal(await status(cookieA), 401);
  controllers.forEach((controller) => controller.abort());
  await Promise.all([
    streamA.completion,
    streamB.completion,
    reconnected.completion,
  ]);
  console.log(
    'Verified two real cookie sessions, HTTP mutations/refetch, shared event identities, rejected actors/origins, permission revocation, disabled-account shutdown and reconnect.',
  );
  if (browser) {
    await prisma.session.create({
      data: {
        token: a.token,
        userId: a.user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await prisma.rolePermission.create({
      data: { roleId: b.role.id, permissionId: readId },
    });
    await prisma.translationKey.create({
      data: {
        key: `${prefix}_browser`,
        categoryId,
        description: 'Before browser edit',
      },
    });
    console.log(
      'BROWSER READY: http://localhost:8082/acceptance/session/a and http://127.0.0.1:8082/acceptance/session/b',
    );
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        process.off('SIGINT', done);
        process.off('SIGTERM', done);
        resolve();
      };
      const timer = setTimeout(done, 20 * 60000);
      finishBrowser = done;
      process.once('SIGINT', done);
      process.once('SIGTERM', done);
    });
  }
} catch (error) {
  failure = error;
} finally {
  controllers.forEach((controller) => controller.abort());
  const cleanup = await Promise.allSettled([app?.close()]);
  try {
    if (fixturesStarted) {
      if (categoryId !== undefined)
        await prisma.translationCategory.delete({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await prisma.permission.deleteMany({
        where: { id: { in: permissionIds } },
      });
      assert.deepEqual(
        await readBaseline(),
        baseline,
        'Disposable records must leave baseline counts unchanged.',
      );
      console.log(
        'Disposable users, sessions, roles, owned permissions and translations removed; existing records/grants preserved.',
      );
    }
  } catch (error) {
    failure ??= error;
  }
  const closed = await Promise.allSettled([prisma.$disconnect(), admin.end()]);
  for (const result of [...cleanup, ...closed])
    if (result.status === 'rejected') failure ??= result.reason;
}
if (failure) {
  console.error(
    failure instanceof Error ? failure.message : 'Acceptance failed',
  );
  process.exitCode = 1;
} else console.log('PASS: authenticated HTTP acceptance and fixture cleanup.');
