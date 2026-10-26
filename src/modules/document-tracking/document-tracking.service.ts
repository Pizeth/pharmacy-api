import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { DBHelper } from 'modules/helpers/services/db-helper';
import type { DataTableQuery } from 'common/data-table';
import { resolveDataTableQueryForHttp } from 'common/data-table/http';
import {
  trackingQueryPolicy,
  trackingTranslator,
} from './document-tracking.query';
import {
  isTrackingAdmin,
  planProgress,
  type TrackingActor,
} from './tracking-policy';
import type {
  AttachmentInput,
  DocumentInput,
  ProgressInput,
  UpdateDocumentInput,
} from './document-tracking.schemas';
const person = {
  id: true,
  name: true,
  image: true,
} satisfies Prisma.UserSelect;
const department = {
  id: true,
  code: true,
  Versions: {
    where: { effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
    take: 1,
    select: { nameKh: true, nameEn: true },
  },
} satisfies Prisma.DepartmentSelect;
const include = {
  category: { select: { id: true, name: true } },
  type: { select: { id: true, name: true } },
  storageLocation: true,
  responsibleDepartment: { select: department },
  steps: {
    orderBy: { position: 'asc' },
    include: {
      assignedTo: { select: person },
      department: { select: department },
    },
  },
} satisfies Prisma.TrackedDocumentInclude;
type RecordRow = Prisma.TrackedDocumentGetPayload<{ include: typeof include }>;
const detailInclude = {
  ...include,
  events: { orderBy: { sequence: 'asc' } },
  attachments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TrackedDocumentInclude;
@Injectable()
export class DocumentTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly db: DBHelper,
  ) {}
  private async actor(userId: number): Promise<TrackingActor> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        banned: true,
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        deletedAt: true,
        userRole: { select: { name: true, isEnabled: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Sign in to track documents.');
    if (
      user.deletedAt ||
      user.banned ||
      user.isEnabled === false ||
      user.isLocked ||
      user.isActivated === false ||
      user.userRole?.isEnabled === false
    )
      throw new ForbiddenException(
        'Your account cannot access document tracking.',
      );
    return {
      id: user.id,
      name: user.name,
      isAdmin: isTrackingAdmin([user.role, user.userRole?.name]),
    };
  }
  private scope(actor: TrackingActor): Prisma.TrackedDocumentWhereInput {
    return actor.isAdmin
      ? {}
      : {
          OR: [
            { createdById: actor.id },
            { steps: { some: { assignedToId: actor.id } } },
            { events: { some: { recipientId: actor.id } } },
          ],
        };
  }
  private format<T extends RecordRow>(record: T, actor: TrackingActor) {
    const current = record.steps.find((step) => step.status === 'ACTIVE');
    const name = (value: RecordRow['responsibleDepartment']) =>
      value
        ? value.Versions[0]?.nameKh || value.Versions[0]?.nameEn || value.code
        : null;
    return {
      ...record,
      responsibleDepartmentName: name(record.responsibleDepartment),
      steps: record.steps.map((step) => ({
        ...step,
        departmentName: name(step.department),
      })),
      permissions: {
        canManage: actor.isAdmin && !record.archivedAt,
        canUpdateProgress:
          !record.archivedAt &&
          record.status !== 'CANCELLED' &&
          (actor.isAdmin ||
            Boolean(current && current.assignedToId === actor.id)),
      },
    };
  }
  async metadata(userId: number) {
    const actor = await this.actor(userId);
    const [workflow, categories, types, handlers, departments] =
      await Promise.all([
        this.prisma.trackingWorkflow.findUnique({
          where: { key: 'shared-document-route' },
          include: { steps: { orderBy: { position: 'asc' } } },
        }),
        this.prisma.documentCategory.findMany({
          where: { isEnabled: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        this.prisma.documentType.findMany({
          where: { isEnabled: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        this.prisma.user.findMany({
          where: {
            AND: [
              { OR: [{ banned: false }, { banned: null }] },
              { OR: [{ isEnabled: true }, { isEnabled: null }] },
              { OR: [{ isLocked: false }, { isLocked: null }] },
              { OR: [{ isActivated: true }, { isActivated: null }] },
              {
                OR: [
                  { userRole: null },
                  { userRole: { isEnabled: { not: false } } },
                ],
              },
            ],
            deletedAt: null,
          },
          orderBy: { name: 'asc' },
          select: person,
        }),
        this.prisma.department.findMany({
          where: { isEnabled: true },
          orderBy: { code: 'asc' },
          select: department,
        }),
      ]);
    if (!workflow?.isEnabled || !workflow.steps.length)
      throw new ConflictException(
        'Document tracking has not been initialized. Apply the document-tracking migration.',
      );
    return {
      actor,
      workflow,
      categories,
      types,
      handlers,
      departments: departments.map((item) => ({
        id: item.id,
        name: item.Versions[0]?.nameKh || item.Versions[0]?.nameEn || item.code,
      })),
    };
  }
  async query(userId: number, input: DataTableQuery) {
    const actor = await this.actor(userId),
      resolved = resolveDataTableQueryForHttp(trackingQueryPolicy, input),
      translated = trackingTranslator.translate(resolved);
    const where: Prisma.TrackedDocumentWhereInput = {
      AND: [{ archivedAt: null }, this.scope(actor), translated.where ?? {}],
    };
    const result = await this.db.getDataTablePage({
      query: { ...translated, where },
      defaultOrderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      operations: {
        findMany: ({ skip, take, where, orderBy }) =>
          this.prisma.trackedDocument.findMany({
            skip,
            take,
            where,
            orderBy: [...orderBy, { id: 'desc' }],
            include,
          }),
        count: ({ where }) => this.prisma.trackedDocument.count({ where }),
      },
    });
    return {
      documents: result.data.map((item) => this.format(item, actor)),
      total: result.metadata.totalItems,
    };
  }
  private async read(
    tx: Prisma.TransactionClient,
    id: string,
    actor: TrackingActor,
  ) {
    const row = await tx.trackedDocument.findFirst({
      where: { id, ...this.scope(actor) },
      include: detailInclude,
    });
    if (!row)
      throw new NotFoundException(
        'Document not found or not available to your account.',
      );
    return row;
  }
  async get(userId: number, id: string) {
    const actor = await this.actor(userId);
    return this.format(await this.read(this.prisma, id, actor), actor);
  }
  private requireAdmin(actor: TrackingActor) {
    if (!actor.isAdmin)
      throw new ForbiddenException('Administrator access is required.');
  }
  private async handler(
    tx: Prisma.TransactionClient,
    id: number | null | undefined,
  ) {
    if (id == null) return null;
    const row = await tx.user.findUnique({
      where: { id },
      select: {
        ...person,
        banned: true,
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        deletedAt: true,
        userRole: { select: { isEnabled: true } },
      },
    });
    if (
      !row ||
      row.banned ||
      row.isEnabled === false ||
      row.isLocked ||
      row.isActivated === false ||
      row.deletedAt ||
      row.userRole?.isEnabled === false
    )
      throw new BadRequestException('Choose an active receiving handler.');
    return row;
  }
  private async office(
    tx: Prisma.TransactionClient,
    id: number | null | undefined,
  ) {
    if (
      id != null &&
      !(await tx.department.findFirst({
        where: { id, isEnabled: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Choose an active responsible office.');
  }
  private async catalogs(tx: Prisma.TransactionClient, input: DocumentInput) {
    const [category, type] = await Promise.all([
      tx.documentCategory.findFirst({
        where: { id: input.categoryId, isEnabled: true },
        select: { id: true },
      }),
      tx.documentType.findFirst({
        where: { id: input.typeId, isEnabled: true },
        select: { id: true },
      }),
    ]);
    if (!category || !type)
      throw new BadRequestException(
        'Choose an active document category and type.',
      );
    if (input.dueAt && new Date(input.dueAt) < new Date(input.receivedAt))
      throw new BadRequestException('Due date cannot precede receipt.');
    await this.office(tx, input.responsibleDepartmentId);
  }
  private async storage(
    tx: Prisma.TransactionClient,
    code: string | null | undefined,
  ) {
    if (!code?.trim()) return null;
    const normalized = code.trim().toUpperCase();
    return tx.documentStorageLocation.upsert({
      where: { code: normalized },
      create: { code: normalized, name: code.trim() },
      update: {},
    });
  }
  private fields(input: DocumentInput) {
    return {
      title: input.title,
      categoryId: input.categoryId,
      typeId: input.typeId,
      subtype: input.subtype || null,
      priority: input.priority,
      incomingNumber: input.incomingNumber || null,
      outgoingNumber: input.outgoingNumber || null,
      receivedAt: new Date(input.receivedAt),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      responsibleDepartmentId: input.responsibleDepartmentId,
      chronologicalCode: input.chronologicalCode || null,
      archiveSequence: input.archiveSequence,
      notes: input.notes || null,
    };
  }
  private async claim(
    tx: Prisma.TransactionClient,
    id: string,
    version: number,
  ) {
    const result = await tx.trackedDocument.updateMany({
      where: { id, version, archivedAt: null },
      data: { version: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'This document changed. Close this form and reload the latest record.',
      );
  }
  async create(userId: number, input: DocumentInput) {
    const actor = await this.actor(userId);
    this.requireAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.catalogs(tx, input);
      const handler = await this.handler(tx, input.assignedToId ?? actor.id),
        storage = await this.storage(tx, input.storageLocationCode);
      const workflow = await tx.trackingWorkflow.findUnique({
        where: { key: 'shared-document-route' },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
      if (!workflow?.isEnabled || !workflow.steps.length)
        throw new ConflictException(
          'The shared document route is unavailable.',
        );
      const document = await tx.trackedDocument.create({
        data: {
          ...this.fields(input),
          workflowId: workflow.id,
          storageLocationId: storage?.id,
          createdById: actor.id,
          steps: {
            create: workflow.steps.map((step, index) => ({
              workflowStepId: step.id,
              key: step.key,
              name: step.name,
              nameKh: step.nameKh,
              position: step.position,
              status: index === 0 ? 'ACTIVE' : 'PENDING',
              assignedToId: index === 0 ? handler?.id : null,
              departmentId: index === 1 ? input.responsibleDepartmentId : null,
              startedAt: index === 0 ? new Date(input.receivedAt) : null,
            })),
          },
        },
      });
      await tx.documentTrackingEvent.create({
        data: {
          documentId: document.id,
          sequence: 1,
          kind: 'REGISTERED',
          actorId: actor.id,
          actorName: actor.name,
          recipientId: handler?.id,
          recipientName: handler?.name,
          toStage: workflow.steps[0].name,
          note: 'Document registered.',
        },
      });
      return this.format(await this.read(tx, document.id, actor), actor);
    });
  }
  async update(userId: number, id: string, input: UpdateDocumentInput) {
    const actor = await this.actor(userId);
    this.requireAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.read(tx, id, actor);
      await this.catalogs(tx, input);
      if (
        input.assignedToId !==
        (current.steps.find((step) => step.status === 'ACTIVE')?.assignedToId ??
          null)
      )
        throw new BadRequestException(
          'Use the progress form to reassign a document.',
        );
      const storage = await this.storage(tx, input.storageLocationCode);
      if (current.status === 'COMPLETED' && !storage)
        throw new BadRequestException(
          'Completed filings must retain a physical storage location.',
        );
      await this.claim(tx, id, input.version);
      await tx.trackedDocument.update({
        where: { id },
        data: { ...this.fields(input), storageLocationId: storage?.id ?? null },
      });
      await tx.documentTrackingEvent.create({
        data: {
          documentId: id,
          sequence: input.version + 1,
          kind: 'UPDATED',
          actorId: actor.id,
          actorName: actor.name,
          note: 'Document metadata updated.',
        },
      });
      return this.format(await this.read(tx, id, actor), actor);
    });
  }
  async progress(userId: number, id: string, input: ProgressInput) {
    const actor = await this.actor(userId);
    return this.prisma.$transaction(async (tx) => {
      const document = await this.read(tx, id, actor),
        plan = planProgress(document, input, actor);
      const handingOff = ['ASSIGN', 'FORWARD', 'RETURN'].includes(input.action);
      const receiver = handingOff
        ? await this.handler(tx, input.assignedToId)
        : null;
      if (handingOff) await this.office(tx, input.departmentId);
      if (
        !handingOff &&
        (input.assignedToId != null || input.departmentId != null)
      )
        throw new BadRequestException(
          'Handler and office are only set during a handoff.',
        );
      const now = new Date();
      const storage =
        plan.kind === 'COMPLETED'
          ? await this.storage(tx, input.storageLocationCode)
          : null;
      if (
        plan.kind === 'COMPLETED' &&
        plan.current.key === 'FILING' &&
        !storage &&
        !document.storageLocationId
      )
        throw new BadRequestException(
          'Enter the physical cabinet or storage location before completing filing.',
        );
      if (
        input.action === 'FORWARD' &&
        plan.current.key === 'DISPATCH' &&
        !input.outgoingNumber?.trim() &&
        !document.outgoingNumber
      )
        throw new BadRequestException(
          'Record the outgoing letter number before confirming dispatch.',
        );
      await this.claim(tx, id, input.version);
      if (input.action === 'FORWARD') {
        await tx.documentStep.update({
          where: { id: plan.current.id },
          data: { status: 'COMPLETED', completedAt: now },
        });
        if (plan.target)
          await tx.documentStep.update({
            where: { id: plan.target.id },
            data: {
              status: 'ACTIVE',
              startedAt: now,
              completedAt: null,
              assignedToId: receiver!.id,
              ...(input.departmentId !== undefined
                ? { departmentId: input.departmentId }
                : {}),
            },
          });
      }
      if (input.action === 'RETURN' && plan.target) {
        await tx.documentStep.updateMany({
          where: { documentId: id, position: { gte: plan.target.position } },
          data: { status: 'PENDING', startedAt: null, completedAt: null },
        });
        await tx.documentStep.update({
          where: { id: plan.target.id },
          data: {
            status: 'ACTIVE',
            startedAt: now,
            assignedToId: receiver!.id,
            ...(input.departmentId !== undefined
              ? { departmentId: input.departmentId }
              : {}),
          },
        });
      }
      if (input.action === 'ASSIGN')
        await tx.documentStep.update({
          where: { id: plan.current.id },
          data: {
            assignedToId: receiver!.id,
            ...(input.departmentId !== undefined
              ? { departmentId: input.departmentId }
              : {}),
          },
        });
      const updates: Prisma.TrackedDocumentUpdateInput = {
        status: plan.status,
        ...(plan.kind === 'COMPLETED'
          ? { completedAt: now }
          : input.action === 'RETURN'
            ? { completedAt: null }
            : {}),
        ...(input.action === 'RETURN' &&
        plan.target &&
        plan.target.position <=
          document.steps.find((step) => step.key === 'STAMPING')!.position
          ? { stampedAt: null }
          : {}),
        ...(input.action === 'RETURN' &&
        plan.target &&
        plan.target.position <=
          document.steps.find((step) => step.key === 'DISPATCH')!.position
          ? { dispatchedAt: null }
          : {}),
        ...(input.action === 'FORWARD' && plan.current.key === 'STAMPING'
          ? { stampedAt: now }
          : {}),
        ...(input.action === 'FORWARD' && plan.current.key === 'DISPATCH'
          ? { dispatchedAt: now }
          : {}),
        ...(input.action === 'FORWARD' &&
        ['STAMPING', 'DISPATCH'].includes(plan.current.key) &&
        input.outgoingNumber?.trim()
          ? { outgoingNumber: input.outgoingNumber.trim() }
          : {}),
        ...(storage
          ? { storageLocation: { connect: { id: storage.id } } }
          : {}),
        ...(plan.kind === 'COMPLETED' && input.chronologicalCode !== undefined
          ? { chronologicalCode: input.chronologicalCode || null }
          : {}),
        ...(plan.kind === 'COMPLETED' && input.archiveSequence !== undefined
          ? { archiveSequence: input.archiveSequence }
          : {}),
      };
      await tx.trackedDocument.update({ where: { id }, data: updates });
      await tx.documentTrackingEvent.create({
        data: {
          documentId: id,
          sequence: input.version + 1,
          stepId: plan.target?.id ?? plan.current.id,
          kind: plan.kind,
          actorId: actor.id,
          actorName: actor.name,
          recipientId: receiver?.id,
          recipientName: receiver?.name,
          fromStage: plan.current.name,
          toStage: plan.target?.name ?? plan.current.name,
          note: input.note || null,
        },
      });
      return this.format(await this.read(tx, id, actor), actor);
    });
  }
  async archive(userId: number, id: string, version: number, note: string) {
    const actor = await this.actor(userId);
    this.requireAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.read(tx, id, actor);
      await this.claim(tx, id, version);
      await tx.trackedDocument.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.documentTrackingEvent.create({
        data: {
          documentId: id,
          sequence: version + 1,
          kind: 'ARCHIVED',
          actorId: actor.id,
          actorName: actor.name,
          note,
        },
      });
      return this.format(await this.read(tx, id, actor), actor);
    });
  }
  async attach(userId: number, id: string, input: AttachmentInput) {
    const actor = await this.actor(userId);
    return this.prisma.$transaction(async (tx) => {
      const document = await this.read(tx, id, actor),
        current = document.steps.find((step) => step.status === 'ACTIVE');
      if (!actor.isAdmin && current?.assignedToId !== actor.id)
        throw new ForbiddenException(
          'Only the assigned handler or an administrator may attach files.',
        );
      await this.claim(tx, id, input.version);
      await tx.documentAttachment.create({
        data: {
          documentId: id,
          name: input.name,
          url: input.url,
          kind: input.kind,
          createdById: actor.id,
        },
      });
      await tx.documentTrackingEvent.create({
        data: {
          documentId: id,
          sequence: input.version + 1,
          kind: 'UPDATED',
          actorId: actor.id,
          actorName: actor.name,
          note:
            'Added ' + input.kind.toLowerCase() + ' attachment: ' + input.name,
        },
      });
      return this.format(await this.read(tx, id, actor), actor);
    });
  }
}
