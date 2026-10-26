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
      // Reuse the real organization and HR models; all these fixtures roll back too.
      const ministry = await tx.ministry.create({
        data: { code: 'SMK-' + randomUUID().slice(0, 8), createdBy: admin.id },
      });
      const ministryVersion = await tx.ministryVersion.create({
        data: {
          ministryId: ministry.id,
          code: ministry.code,
          nameKh: 'Smoke ministry',
          nameEn: 'Smoke ministry',
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      const office = await tx.department.create({
        data: { code: 'SMK-' + randomUUID().slice(0, 8), createdBy: admin.id },
      });
      const officeVersion = await tx.departmentVersion.create({
        data: {
          departmentId: office.id,
          ministryVersionId: ministryVersion.id,
          code: office.code,
          nameKh: 'Smoke specialist office',
          nameEn: 'Smoke specialist office',
          effectiveFrom: new Date('2026-01-01'),
          createdBy: admin.id,
        },
      });
      const profile = await tx.profile.create({
        data: {
          officialId: randomUUID().replaceAll('-', '').slice(0, 10),
          firstName: 'Smoke',
          lastName: 'Handler',
          sex: 'Male',
          dob: new Date('1990-01-01'),
          entryDate: new Date('2020-01-01'),
          createdBy: admin.id,
          updatedBy: admin.id,
          userId: handler.id,
        },
      });
      const employment = await tx.employmentHistory.create({
        data: {
          profileId: profile.id,
          ministryVersionId: ministryVersion.id,
          departmentVersionId: officeVersion.id,
          assignmentType: 'INITIAL_APPOINTMENT',
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          positionTitle: 'Document officer',
        },
      });
      await tx.profile.update({
        where: { id: profile.id },
        data: { currentEmploymentId: employment.id },
      });
      const metadata = await service.metadata(admin.id);
      assert.equal(
        metadata.handlers.find((p) => p.id === handler.id)?.departmentId,
        office.id,
      );
      assert.equal(
        metadata.handlers.find((p) => p.id === handler.id)?.positionTitle,
        'Document officer',
      );
      assert(
        metadata.departments.some(
          (p) => p.id === office.id && p.name.includes('Smoke ministry'),
        ),
      );
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
      assert.equal(
        doc.steps.find((step) => step.status === 'ACTIVE')?.departmentId,
        office.id,
      );
      assert.equal(doc.events.at(-1)?.recipientEmploymentId, employment.id);
      assert.equal(
        doc.events.at(-1)?.recipientDepartmentVersionId,
        officeVersion.id,
      );
      assert.equal(
        doc.events.at(-1)?.recipientOfficeName,
        'Smoke specialist office',
      );
      await tx.departmentVersion.update({
        where: { id: officeVersion.id },
        data: { effectiveTo: new Date() },
      });
      await tx.departmentVersion.create({
        data: {
          departmentId: office.id,
          ministryVersionId: ministryVersion.id,
          code: office.code,
          nameKh: 'Renamed smoke office',
          nameEn: 'Renamed smoke office',
          effectiveFrom: new Date(),
          createdBy: admin.id,
        },
      });
      const afterRename = await service.get(admin.id, doc.id);
      assert.equal(
        afterRename.events.at(-1)?.recipientOfficeName,
        'Smoke specialist office',
      );
      assert.equal(
        afterRename.steps.find((step) => step.status === 'ACTIVE')
          ?.departmentName,
        'Renamed smoke office',
      );
      console.log(
        'PASS: HR-derived receiving office, employment/version references and historical snapshots survive an office rename.',
      );
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
