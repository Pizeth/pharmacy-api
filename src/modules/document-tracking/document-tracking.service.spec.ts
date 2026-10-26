import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentTrackingService } from './document-tracking.service';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import type { DBHelper } from 'modules/helpers/services/db-helper';
const mock = () => ({
  user: {
    findUnique: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        id: 2,
        name: 'Handler',
        role: 'user',
        isEnabled: true,
        isActivated: true,
        userRole: null,
      }),
  },
  trackedDocument: {
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    updateMany: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ count: 1 }),
    update: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({}),
  },
  documentStep: {
    update: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({}),
    updateMany: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ count: 2 }),
  },
  documentTrackingEvent: {
    create: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({}),
  },
  documentAttachment: {
    create: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({}),
  },
  department: {
    findFirst: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ id: 1 }),
  },
});
const record = () => ({
  id: 'document',
  version: 3,
  status: 'ACTIVE',
  archivedAt: null,
  responsibleDepartment: null,
  steps: ['RECEIVED', 'STAMPING', 'DISPATCH', 'FILING'].map(
    (key, position) => ({
      id: String(position),
      key,
      name: key,
      position,
      status:
        position === 1 ? 'ACTIVE' : position === 0 ? 'COMPLETED' : 'PENDING',
      assignedToId: 2,
      department: null,
    }),
  ),
  events: [],
  attachments: [],
});
function setup() {
  const tx = mock();
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (run: (value: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  return {
    tx,
    service: new DocumentTrackingService(
      prisma as unknown as PrismaService,
      {} as DBHelper,
    ),
  };
}
it('scopes record reads to creator, stage handlers and history recipients', async () => {
  const { tx, service } = setup();
  tx.trackedDocument.findFirst.mockResolvedValue(null);
  await expect(service.get(2, 'document')).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(tx.trackedDocument.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: 'document',
        OR: [
          { createdById: 2 },
          { steps: { some: { assignedToId: 2 } } },
          { events: { some: { recipientId: 2 } } },
        ],
      }),
    }),
  );
});
it('denies create and archive to non-admin handlers before writes', async () => {
  const { tx, service } = setup();
  await expect(
    service.archive(2, 'document', 3, 'Archive'),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(tx.trackedDocument.updateMany).not.toHaveBeenCalled();
});
it('rejects disabled accounts even when a session is present', async () => {
  const { tx, service } = setup();
  tx.user.findUnique.mockResolvedValue({
    id: 2,
    name: 'Blocked',
    role: 'admin',
    isEnabled: false,
  });
  await expect(service.get(2, 'document')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(tx.trackedDocument.findFirst).not.toHaveBeenCalled();
});
it('does not write a step or event when the atomic version claim loses a race', async () => {
  const { tx, service } = setup();
  tx.trackedDocument.findFirst.mockResolvedValue(record());
  tx.trackedDocument.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    service.progress(2, 'document', {
      version: 3,
      action: 'FORWARD',
      assignedToId: 2,
      note: null,
    }),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(tx.documentStep.update).not.toHaveBeenCalled();
  expect(tx.documentTrackingEvent.create).not.toHaveBeenCalled();
});
it('records a forward handoff and its actor/recipient snapshots inside the transaction', async () => {
  const { tx, service } = setup();
  tx.trackedDocument.findFirst.mockResolvedValue(record());
  await service.progress(2, 'document', {
    version: 3,
    action: 'FORWARD',
    assignedToId: 2,
    note: 'Sent to dispatch',
    outgoingNumber: 'OUT-01',
  });
  expect(tx.documentStep.update).toHaveBeenCalledWith({
    where: { id: '1' },
    data: { status: 'COMPLETED', completedAt: expect.any(Date) },
  });
  expect(tx.documentStep.update).toHaveBeenCalledWith({
    where: { id: '2' },
    data: expect.objectContaining({ status: 'ACTIVE', assignedToId: 2 }),
  });
  expect(tx.documentTrackingEvent.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      sequence: 4,
      actorId: 2,
      actorName: 'Handler',
      recipientId: 2,
      recipientName: 'Handler',
      fromStage: 'STAMPING',
      toStage: 'DISPATCH',
      kind: 'FORWARDED',
    }),
  });
});
it('resets downstream state on return without deleting historical events', async () => {
  const { tx, service } = setup();
  tx.trackedDocument.findFirst.mockResolvedValue(record());
  await service.progress(2, 'document', {
    version: 3,
    action: 'RETURN',
    assignedToId: 2,
    targetPosition: 0,
    note: 'Needs correction',
  });
  expect(tx.documentStep.updateMany).toHaveBeenCalledWith({
    where: { documentId: 'document', position: { gte: 0 } },
    data: { status: 'PENDING', startedAt: null, completedAt: null },
  });
  expect(tx.trackedDocument.update).toHaveBeenCalledWith({
    where: { id: 'document' },
    data: expect.objectContaining({
      status: 'ACTIVE',
      completedAt: null,
      stampedAt: null,
      dispatchedAt: null,
    }),
  });
  expect(tx.documentTrackingEvent.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      kind: 'RETURNED',
      note: 'Needs correction',
      sequence: 4,
    }),
  });
});
it('rejects former handler progress even on a readable record', async () => {
  const { tx, service } = setup();
  tx.trackedDocument.findFirst.mockResolvedValue({
    ...record(),
    steps: record().steps.map((s) => ({ ...s, assignedToId: 99 })),
  });
  await expect(
    service.progress(2, 'document', {
      version: 3,
      action: 'COMMENT',
      note: 'Old handler',
    }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(tx.trackedDocument.updateMany).not.toHaveBeenCalled();
});
