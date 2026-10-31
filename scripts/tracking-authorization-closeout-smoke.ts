/** Isolated cross-repository HTTP smoke: all DB fixtures roll back. No real storage or scanner calls. */
import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';
import { Test } from '@nestjs/testing';
import {
  VersioningType,
  StandardSchemaValidationPipe,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../src/modules/prisma/services/prisma.service';
import { DBHelper } from '../src/modules/helpers/services/db-helper';
import { DocumentTrackingService } from '../src/modules/document-tracking/document-tracking.service';
import { DocumentTrackingController } from '../src/modules/document-tracking/document-tracking.controller';
import type { R2Service } from '../src/modules/files/services/cloudflare-r2.service';
import { type as ResponseType } from '../src/types/commons.enum';
const prisma = new PrismaService();
const runId = randomUUID();
const rollback = new Error('ROLLBACK_AUTHORIZATION_CLOSEOUT');
const nativeFetch = globalThis.fetch;
const priorBackend = process.env.BACKEND_URL;
const tempModule = resolve(
  dirname(fileURLToPath(import.meta.url)),
  `.tracking-client-${runId}.mjs`,
);
const clientRoot = resolve(
  process.env.TRACKING_CLIENT_ROOT || '../pharmacy-client',
);
const baselineGrants = await prisma.rolePermission.count();
let checks = 0;
let failure: unknown;
try {
  await prisma.$transaction(
    async (tx) => {
      const adapter = new Proxy(prisma, {
        get: (_target, key) =>
          key === '$transaction'
            ? async (run: (db: typeof tx) => Promise<unknown>) => run(tx)
            : Reflect.get(tx, key),
      });
      const makeUser = (label: string, role = 'user') =>
        tx.user.create({
          data: {
            name: `Authorization smoke ${label}`,
            email: `${runId}-${label}@example.invalid`,
            role,
            isEnabled: true,
            isActivated: true,
            isLocked: false,
            banned: false,
          },
        });
      const admin = await makeUser('admin', 'admin');
      const handler = await makeUser('handler');
      const reader = await makeUser('reader');
      const grant = await tx.permission.findUniqueOrThrow({
        where: {
          action_subject: { action: 'manage', subject: 'TrackedDocument' },
        },
      });
      const role = await tx.role.create({
        data: {
          name: `SMOKE_${runId.replaceAll('-', '').slice(0, 20)}`,
          createdBy: admin.id,
          updatedBy: admin.id,
          permissions: { create: { permissionId: grant.id } },
        },
      });
      const manager = await tx.user.create({
        data: {
          name: 'Authorization smoke manager',
          email: `${runId}-manager@example.invalid`,
          role: 'user',
          roleId: role.id,
          isEnabled: true,
          isActivated: true,
          isLocked: false,
          banned: false,
        },
      });
      const keys = new Set<string>();
      const deletedKeys: string[] = [];
      let afterStore: (() => Promise<void>) | undefined;
      const storage = {
        uploadFile: async (_file: unknown, key: string) => {
          keys.add(key);
          await afterStore?.();
          return {
            type: ResponseType.Upload,
            status: 201,
            url: `https://example.invalid/${key}`,
          };
        },
        deleteFile: async (key: string) => {
          keys.delete(key);
          deletedKeys.push(key);
          return { type: ResponseType.Delete, status: 200 };
        },
      };
      const service = new DocumentTrackingService(
        adapter,
        new DBHelper(adapter),
        storage as unknown as R2Service,
      );
      Reflect.defineMetadata(
        'design:paramtypes',
        [DocumentTrackingService],
        DocumentTrackingController,
      );
      const module = await Test.createTestingModule({
        controllers: [DocumentTrackingController],
        providers: [{ provide: DocumentTrackingService, useValue: service }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest();
            req.session = { user: { id: req.headers['x-smoke-actor'] } };
            return true;
          },
        })
        .compile();
      const app = module.createNestApplication({ logger: false });
      app.useGlobalPipes(new StandardSchemaValidationPipe());
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      let actorId = admin.id;
      try {
        await app.listen(0, '127.0.0.1');
        const origin = await app.getUrl();
        process.env.BACKEND_URL = origin;
        globalThis.fetch = (input, init = {}) => {
          assert(
            String(input).startsWith(origin + '/'),
            'Smoke transport must stay on loopback',
          );
          return nativeFetch(input, {
            ...init,
            headers: { ...init.headers, 'x-smoke-actor': String(actorId) },
          });
        };
        const compiled = await build({
          entryPoints: [
            resolve(clientRoot, 'src/features/document-tracking/api.ts'),
          ],
          bundle: true,
          platform: 'node',
          format: 'esm',
          packages: 'external',
          alias: {
            '@/types/constants': resolve(clientRoot, 'src/types/constants.ts'),
          },
          write: false,
        });
        await writeFile(tempModule, compiled.outputFiles[0].text);
        const { trackingApi: api } = await import(
          pathToFileURL(tempModule).href
        );
        const metadata = await api.metadata();
        assert(metadata.actor.isTrackingAdmin);
        checks++;
        let doc = await api.save({
          title: `Disposable authorization smoke ${runId}`,
          categoryId: metadata.categories[0].id,
          typeId: metadata.types[0].id,
          subtype: null,
          priority: 'NORMAL',
          incomingNumber: null,
          outgoingNumber: null,
          receivedAt: new Date().toISOString(),
          dueAt: null,
          responsibleDepartmentId: null,
          assignedToId: handler.id,
          storageLocationCode: null,
          chronologicalCode: null,
          archiveSequence: null,
          notes: 'Rollback-only fixture',
        });
        const rejects = async (run: () => Promise<unknown>, status: number) => {
          await assert.rejects(run, (error: unknown) =>
            Boolean(
              error &&
              typeof error === 'object' &&
              'status' in error &&
              error.status === status,
            ),
          );
          checks++;
        };
        actorId = manager.id;
        const delegated = await api.metadata();
        assert.equal(delegated.actor.isAdmin, true);
        assert.equal(delegated.actor.isTrackingAdmin, false);
        checks++;
        doc = await api.get(doc.id);
        assert.equal(doc.permissions.canAttach, true);
        assert.equal(doc.permissions.canUpdateProgress, false);
        checks++;
        doc = await api.attachment(doc.id, doc.version, {
          name: 'URL fixture',
          kind: 'SUPPORTING',
          url: 'https://example.invalid/disposable.txt',
        });
        checks++;
        doc = await api.uploadAttachment(
          doc.id,
          doc.version,
          { name: 'Upload fixture', kind: 'SUPPORTING' },
          new File(['inert smoke notes'], 'fixture.txt', {
            type: 'text/plain',
          }),
        );
        checks++;
        const linkedKeys = [...keys];
        afterStore = async () => {
          afterStore = undefined;
          await tx.trackedDocument.update({
            where: { id: doc.id },
            data: { version: { increment: 1 } },
          });
        };
        await rejects(
          () =>
            api.uploadAttachment(
              doc.id,
              doc.version,
              { name: 'Post-storage race', kind: 'SUPPORTING' },
              new File(['inert race'], 'race.txt', { type: 'text/plain' }),
            ),
          409,
        );
        assert.equal(
          deletedKeys.length,
          1,
          'Failed linking must delete its uploaded object',
        );
        assert.deepEqual(
          [...keys],
          linkedKeys,
          'Unlinked upload must be removed before teardown',
        );
        checks++;
        doc = await api.get(doc.id);
        await rejects(
          () =>
            api.progress(doc.id, {
              version: doc.version,
              action: 'COMMENT',
              note: 'Must fail',
            }),
          403,
        );
        await rejects(
          () =>
            api.progress(doc.id, {
              version: doc.version,
              action: 'CANCEL',
              note: 'Must fail',
            }),
          403,
        );
        await rejects(
          () =>
            api.attachment(doc.id, doc.version - 1, {
              name: 'Stale',
              kind: 'SUPPORTING',
              url: 'https://example.invalid/stale',
            }),
          409,
        );
        actorId = reader.id;
        await rejects(() => api.get(doc.id), 404);
        actorId = handler.id;
        doc = await api.attachment(doc.id, doc.version, {
          name: 'Assigned handler',
          kind: 'SUPPORTING',
          url: 'https://example.invalid/handler',
        });
        checks++;
        await rejects(
          () =>
            api.progress(doc.id, {
              version: doc.version,
              action: 'CANCEL',
              note: 'No administrator override',
            }),
          403,
        );
        doc = await api.progress(doc.id, {
          version: doc.version,
          action: 'COMMENT',
          note: 'Assigned handling note',
        });
        checks++;
        await tx.user.update({
          where: { id: manager.id },
          data: { isEnabled: false },
        });
        actorId = manager.id;
        await rejects(
          () =>
            api.uploadAttachment(
              doc.id,
              doc.version,
              { name: 'Disabled', kind: 'SUPPORTING' },
              new File(['inert'], 'disabled.txt'),
            ),
          403,
        );
        await tx.user.update({
          where: { id: manager.id },
          data: { isEnabled: true },
        });
        await tx.trackedDocument.update({
          where: { id: doc.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.documentStep.updateMany({
          where: { documentId: doc.id },
          data: { status: 'COMPLETED' },
        });
        await rejects(
          () =>
            api.progress(doc.id, {
              version: doc.version,
              action: 'RETURN',
              targetPosition: 0,
              assignedToId: handler.id,
              note: 'Cannot reopen',
            }),
          403,
        );
        actorId = admin.id;
        doc = await api.get(doc.id);
        doc = await api.attachment(doc.id, doc.version, {
          name: 'Completed administrator attachment',
          kind: 'SUPPORTING',
          url: 'https://example.invalid/completed',
        });
        checks++;
        console.log(
          `PASS: ${checks} cross-repository transport/controller/database authorization checks; storage mocked; fixtures rollback.`,
        );
      } finally {
        globalThis.fetch = nativeFetch;
        for (const key of [...keys]) await storage.deleteFile(key);
        assert.equal(
          keys.size,
          0,
          'Mock storage must be empty before closing the app',
        );
        await app.close();
      }
      throw rollback;
    },
    { timeout: 120000, maxWait: 15000 },
  );
} catch (error) {
  if (error !== rollback) failure = error;
} finally {
  globalThis.fetch = nativeFetch;
  if (priorBackend === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = priorBackend;
  await unlink(tempModule).catch(() => {});
  await prisma.$disconnect();
}
const verify = new PrismaService();
try {
  assert.equal(
    await verify.user.count({ where: { email: { contains: runId } } }),
    0,
  );
  assert.equal(
    await verify.trackedDocument.count({
      where: { title: { contains: runId } },
    }),
    0,
  );
  assert.equal(
    await verify.role.count({
      where: { name: `SMOKE_${runId.replaceAll('-', '').slice(0, 20)}` },
    }),
    0,
  );
  assert.equal(await verify.rolePermission.count(), baselineGrants);
  console.log(
    'PASS: disposable users, role, grants, documents and attachments rolled back; existing role grants preserved.',
  );
} finally {
  await verify.$disconnect();
}

if (failure) throw failure;
