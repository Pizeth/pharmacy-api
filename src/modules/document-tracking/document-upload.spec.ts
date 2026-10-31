import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { DocumentTrackingService } from './document-tracking.service';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import type { DBHelper } from 'modules/helpers/services/db-helper';
import type { R2Service } from 'modules/files/services/cloudflare-r2.service';
import { type as ResponseType } from 'types/commons.enum';
const fn = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const input = { version: 3, name: 'Letter', kind: 'INCOMING' as const };
const file = {
  originalname: 'letter.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF'),
  size: 4,
} as Express.Multer.File;
const person = (kind: string) => ({
  id: 2,
  name: 'Fixture',
  role: kind === 'admin' ? 'admin' : 'user',
  isEnabled: true,
  isActivated: true,
  userRole:
    kind === 'manager'
      ? {
          name: 'MANAGER',
          isEnabled: true,
          permissions: [
            { permission: { action: 'manage', subject: 'TrackedDocument' } },
          ],
        }
      : null,
});
const document = (assigned = 2) => ({
  id: 'document',
  version: 3,
  archivedAt: null,
  status: 'ACTIVE',
  responsibleDepartment: null,
  steps: [
    { id: 'step', status: 'ACTIVE', assignedToId: assigned, department: null },
  ],
  events: [],
  attachments: [],
});
function setup(kind = 'handler', assigned = 2) {
  const db = {
    user: { findUnique: fn().mockResolvedValue(person(kind)) },
    trackedDocument: {
      findFirst: fn().mockResolvedValue(document(assigned)),
      updateMany: fn().mockResolvedValue({ count: 1 }),
    },
    documentAttachment: { create: fn() },
    documentTrackingEvent: { create: fn() },
  };
  const prisma = {
    ...db,
    $transaction: async (run: (tx: typeof db) => Promise<unknown>) => run(db),
  };
  const files = {
    uploadFile: fn().mockResolvedValue({
      type: ResponseType.Upload,
      status: 201,
      url: 'https://files.example/letter.pdf',
    }),
    deleteFile: fn().mockResolvedValue({
      type: ResponseType.Delete,
      status: 200,
    }),
  };
  const service = new DocumentTrackingService(
    prisma as unknown as PrismaService,
    {} as DBHelper,
    files as unknown as R2Service,
  );
  const run = (mode: string) =>
    mode === 'upload'
      ? service.uploadAttachment(2, 'document', input, file)
      : service.attach(2, 'document', {
          ...input,
          url: 'https://files.example/letter.pdf',
        });
  return { db, files, service, run };
}
for (const mode of ['upload', 'url']) {
  it.each([
    ['admin', 99, true],
    ['manager', 99, true],
    ['handler', 2, true],
    ['former', 99, false],
    ['reader', 99, false],
  ] as const)(
    `${mode}: %s attachment authority`,
    async (kind, assigned, allowed) => {
      const { run, db, files } = setup(kind, assigned);
      if (allowed) {
        const result = await run(mode);
        expect(result.permissions.canAttach).toBe(true);
        expect(db.documentAttachment.create).toHaveBeenCalled();
      } else {
        await expect(run(mode)).rejects.toBeInstanceOf(ForbiddenException);
        expect(db.documentAttachment.create).not.toHaveBeenCalled();
        expect(files.uploadFile).not.toHaveBeenCalled();
      }
    },
  );
  it.each([
    { isEnabled: false },
    { isActivated: false },
    { banned: true },
    { isLocked: true },
    { deletedAt: new Date() },
    { userRole: { name: 'MANAGER', isEnabled: false } },
  ])(`${mode}: rejects disabled account or role %j`, async (change) => {
    const { run, db, files } = setup('manager', 99);
    db.user.findUnique.mockResolvedValue({ ...person('manager'), ...change });
    await expect(run(mode)).rejects.toBeInstanceOf(ForbiddenException);
    expect(files.uploadFile).not.toHaveBeenCalled();
    expect(db.trackedDocument.updateMany).not.toHaveBeenCalled();
  });
  it(`${mode}: rejects stale version before claiming`, async () => {
    const { run, db, files } = setup();
    db.trackedDocument.findFirst.mockResolvedValue({
      ...document(),
      version: 4,
    });
    await expect(run(mode)).rejects.toBeInstanceOf(ConflictException);
    expect(files.uploadFile).not.toHaveBeenCalled();
    expect(db.trackedDocument.updateMany).not.toHaveBeenCalled();
  });
  it(`${mode}: rejects archived records`, async () => {
    const { run, db, files } = setup('admin');
    db.trackedDocument.findFirst.mockResolvedValue({
      ...document(),
      archivedAt: new Date(),
    });
    await expect(run(mode)).rejects.toBeInstanceOf(ForbiddenException);
    expect(files.uploadFile).not.toHaveBeenCalled();
  });
  it(`${mode}: preserves version claim conflicts`, async () => {
    const { run, db, files } = setup();
    db.trackedDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(run(mode)).rejects.toBeInstanceOf(ConflictException);
    expect(db.documentAttachment.create).not.toHaveBeenCalled();
    if (mode === 'upload')
      expect(files.deleteFile).toHaveBeenCalledWith(
        files.uploadFile.mock.calls[0][1],
      );
  });
}
it.each(['disabled', 'revoked', 'reassigned', 'stale'])(
  'rechecks %s after storage and removes the unlinked file',
  async (change) => {
    const { run, db, files } =
      change === 'reassigned' ? setup('handler', 2) : setup('manager', 99);
    files.uploadFile.mockImplementation(() => {
      if (change === 'disabled')
        db.user.findUnique.mockResolvedValue({
          ...person('manager'),
          isEnabled: false,
        });
      if (change === 'revoked')
        db.user.findUnique.mockResolvedValue(person('handler'));
      if (change === 'reassigned')
        db.trackedDocument.findFirst.mockResolvedValue(document(99));
      if (change === 'stale')
        db.trackedDocument.findFirst.mockResolvedValue({
          ...document(99),
          version: 4,
        });
      return Promise.resolve({
        type: ResponseType.Upload,
        status: 201,
        url: 'https://files.example/letter.pdf',
      });
    });
    await expect(run('upload')).rejects.toBeInstanceOf(
      change === 'stale' ? ConflictException : ForbiddenException,
    );
    expect(files.deleteFile).toHaveBeenCalledWith(
      files.uploadFile.mock.calls[0][1],
    );
    expect(db.documentAttachment.create).not.toHaveBeenCalled();
  },
);
it('preserves the original conflict when cleanup fails', async () => {
  const { run, db, files } = setup();
  const log = jest.spyOn(Logger, 'error').mockImplementation(() => {});
  db.trackedDocument.updateMany.mockResolvedValue({ count: 0 });
  files.deleteFile.mockRejectedValue(new Error('storage unavailable'));
  await expect(run('upload')).rejects.toBeInstanceOf(ConflictException);
  log.mockRestore();
});
it('never links an upload rejected by scanning', async () => {
  const { run, db, files } = setup();
  files.uploadFile.mockResolvedValue({
    type: ResponseType.Error,
    status: 422,
    message: 'Malware detected',
  });
  await expect(run('upload')).rejects.toBeInstanceOf(HttpException);
  expect(db.documentAttachment.create).not.toHaveBeenCalled();
});
it('uses a generated storage key and links the stored URL', async () => {
  const { run, files, db } = setup();
  await run('upload');
  expect(files.uploadFile).toHaveBeenCalledWith(
    file,
    expect.stringMatching(/^tracking-document-[\da-f-]+\.pdf$/),
  );
  expect(db.documentAttachment.create.mock.calls[0][0]).toMatchObject({
    data: {
      url: 'https://files.example/letter.pdf',
      createdById: 2,
    },
  });
});
