/** Real database/service smoke test. Every sample row is rolled back. Run with tsx --tsconfig tsconfig.seed.json. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { PrismaService } from '../src/modules/prisma/services/prisma.service';
import { DBHelper } from '../src/modules/helpers/services/db-helper';
import { DocumentTrackingService } from '../src/modules/document-tracking/document-tracking.service';
import { dataTableQuerySchema } from '../src/common/data-table';
const prisma = new PrismaService();
const rollback = new Error('ROLLBACK_SMOKE_TEST');
const before = await prisma.trackedDocument.count();
try {
  await prisma.$transaction(
    async (tx) => {
      const adapter = new Proxy(prisma, {
        get: (_target, key) =>
          key === '$transaction'
            ? async (run: (db: typeof tx) => Promise<unknown>) => run(tx)
            : Reflect.get(tx, key),
      });
      const service = new DocumentTrackingService(
        adapter,
        new DBHelper(adapter),
      );
      const admin = await tx.user.findFirst({
        where: {
          OR: [
            { role: { contains: 'admin', mode: 'insensitive' } },
            { userRole: { name: { contains: 'admin', mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      });
      assert(admin, 'An active administrator is needed for this smoke test.');
      const handler = await tx.user.create({
        data: {
          name: 'Temporary smoke-test handler',
          email: randomUUID() + '@example.invalid',
          role: 'user',
          isEnabled: true,
          isActivated: true,
          isLocked: false,
          banned: false,
        },
      });
      const metadata = await service.metadata(admin.id);
      assert.equal(metadata.workflow.steps.length, 7);
      assert(metadata.handlers.some((p) => p.id === handler.id));
      let doc = await service.create(admin.id, {
        title: 'Rollback-only document-tracking smoke test',
        categoryId: metadata.categories[0].id,
        typeId: metadata.types[0].id,
        subtype: null,
        priority: 'URGENT',
        incomingNumber: 'SMOKE-IN',
        outgoingNumber: null,
        receivedAt: new Date().toISOString(),
        dueAt: null,
        responsibleDepartmentId: null,
        assignedToId: admin.id,
        storageLocationCode: null,
        chronologicalCode: null,
        archiveSequence: null,
        notes: 'This entire transaction is rolled back.',
      });
      assert.equal(doc.version, 1);
      assert.equal(doc.events.length, 1);
      doc = await service.progress(admin.id, doc.id, {
        version: doc.version,
        action: 'FORWARD',
        assignedToId: handler.id,
        note: 'Hand over to specialist',
      });
      await assert.rejects(
        () =>
          service.progress(admin.id, doc.id, {
            version: 1,
            action: 'HOLD',
            note: 'Stale form',
          }),
        /changed/,
      );
      await assert.rejects(
        () => service.archive(handler.id, doc.id, doc.version, 'Forbidden'),
        /Administrator/,
      );
      doc = await service.progress(handler.id, doc.id, {
        version: doc.version,
        action: 'HOLD',
        note: 'Waiting for signature',
      });
      assert.equal(doc.status, 'ON_HOLD');
      await assert.rejects(
        () =>
          service.progress(handler.id, doc.id, {
            version: doc.version,
            action: 'FORWARD',
            assignedToId: admin.id,
            note: null,
          }),
        /Resume/,
      );
      doc = await service.progress(handler.id, doc.id, {
        version: doc.version,
        action: 'RESUME',
        note: null,
      });
      doc = await service.progress(handler.id, doc.id, {
        version: doc.version,
        action: 'RETURN',
        targetPosition: 0,
        assignedToId: admin.id,
        note: 'Correction needed',
      });
      const returnedHistory = doc.events.length;
      assert.equal(doc.steps.filter((s) => s.status === 'ACTIVE').length, 1);
      await assert.rejects(
        () =>
          service.progress(handler.id, doc.id, {
            version: doc.version,
            action: 'COMMENT',
            note: 'Former handler',
          }),
        /currently assigned/,
      );
      while (doc.status !== 'COMPLETED') {
        doc = await service.progress(admin.id, doc.id, {
          version: doc.version,
          action: 'FORWARD',
          assignedToId: admin.id,
          note: 'Confirm shared stage',
          outgoingNumber: 'SMOKE-OUT',
          storageLocationCode: 'SMOKE-ROLLBACK',
          chronologicalCode: '2026-SMOKE',
          archiveSequence: 1,
        });
      }
      assert(doc.events.length > returnedHistory);
      assert.equal(doc.steps.filter((s) => s.status === 'COMPLETED').length, 7);
      assert(doc.completedAt);
      assert(doc.stampedAt);
      assert(doc.dispatchedAt);
      assert.equal(doc.storageLocation?.code, 'SMOKE-ROLLBACK');
      const page = await service.query(
        admin.id,
        dataTableQuerySchema.parse({
          page: 1,
          pageSize: 25,
          search: { term: 'Rollback-only' },
        }),
      );
      assert(page.documents.some((item) => item.id === doc.id));
      doc = await service.archive(
        admin.id,
        doc.id,
        doc.version,
        'End of rollback-only smoke test',
      );
      assert(doc.archivedAt);
      assert.equal(doc.events.at(-1)?.kind, 'ARCHIVED');
      const afterArchive = await service.query(
        admin.id,
        dataTableQuerySchema.parse({
          page: 1,
          pageSize: 25,
          search: { term: 'Rollback-only' },
        }),
      );
      assert(!afterArchive.documents.some((item) => item.id === doc.id));
      console.log(
        'PASS: real metadata, registration, handoff, stale version, permissions, hold/resume, return, seven-stage completion, storage, query and soft archive.',
      );
      throw rollback;
    },
    { timeout: 90000, maxWait: 15000 },
  );
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}
const verify = new PrismaService();
try {
  assert.equal(await verify.trackedDocument.count(), before);
  assert.equal(
    await verify.user.count({
      where: {
        email: { endsWith: '@example.invalid' },
        name: 'Temporary smoke-test handler',
      },
    }),
    0,
  );
  console.log(
    'PASS: all sample documents and users rolled back; original document count retained.',
  );
} finally {
  await verify.$disconnect();
}
