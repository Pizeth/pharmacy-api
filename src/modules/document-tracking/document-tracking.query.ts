import { z } from 'zod';
import type { Prisma } from 'generated/prisma/client';
import {
  createDataTableQueryPolicy,
  createDataTablePrismaTranslator,
} from 'common/data-table';
const text = z.string().trim().min(1).max(500),
  uuid = z.uuid(),
  id = z.number().int().positive();
export const trackingQueryPolicy = createDataTableQueryPolicy({
  sorting: {
    registrationNumber: { target: 'registrationNumber' },
    title: { target: 'title' },
    receivedAt: { target: 'receivedAt' },
    dueAt: { target: 'dueAt' },
    status: { target: 'status' },
    priority: { target: 'priority' },
  },
  filtering: {
    title: {
      target: 'title',
      operators: ['contains'],
      values: { contains: text },
    },
    incomingNumber: {
      target: 'incomingNumber',
      operators: ['contains'],
      values: { contains: text },
    },
    categoryId: {
      target: 'categoryId',
      operators: ['equals'],
      values: { equals: uuid },
    },
    typeId: {
      target: 'typeId',
      operators: ['equals'],
      values: { equals: uuid },
    },
    status: {
      target: 'status',
      operators: ['equals'],
      values: {
        equals: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
      },
    },
    priority: {
      target: 'priority',
      operators: ['equals'],
      values: { equals: z.enum(['NORMAL', 'URGENT']) },
    },
    assignedToId: {
      target: 'assignedToId',
      operators: ['equals'],
      values: { equals: id },
    },
    responsibleDepartmentId: {
      target: 'responsibleDepartmentId',
      operators: ['equals'],
      values: { equals: id },
    },
  },
  search: {
    targets: ['title', 'incomingNumber', 'outgoingNumber', 'chronologicalCode'],
  },
});
export const trackingTranslator = createDataTablePrismaTranslator<
  Prisma.TrackedDocumentWhereInput,
  Prisma.TrackedDocumentOrderByWithRelationInput
>()({
  policy: trackingQueryPolicy,
  sorting: {
    registrationNumber: (direction) => ({ registrationNumber: direction }),
    title: (direction) => ({ title: direction }),
    receivedAt: (direction) => ({ receivedAt: direction }),
    dueAt: (direction) => ({ dueAt: direction }),
    status: (direction) => ({ status: direction }),
    priority: (direction) => ({ priority: direction }),
  },
  filtering: {
    title: {
      contains: (value) => ({
        title: { contains: value, mode: 'insensitive' },
      }),
    },
    incomingNumber: {
      contains: (value) => ({
        incomingNumber: { contains: value, mode: 'insensitive' },
      }),
    },
    categoryId: { equals: (value) => ({ categoryId: value }) },
    typeId: { equals: (value) => ({ typeId: value }) },
    status: { equals: (value) => ({ status: value }) },
    priority: { equals: (value) => ({ priority: value }) },
    assignedToId: {
      equals: (value) => ({
        steps: { some: { status: 'ACTIVE', assignedToId: value } },
      }),
    },
    responsibleDepartmentId: {
      equals: (value) => ({ responsibleDepartmentId: value }),
    },
  },
  search: {
    title: (term) => ({ title: { contains: term, mode: 'insensitive' } }),
    incomingNumber: (term) => ({
      incomingNumber: { contains: term, mode: 'insensitive' },
    }),
    outgoingNumber: (term) => ({
      outgoingNumber: { contains: term, mode: 'insensitive' },
    }),
    chronologicalCode: (term) => ({
      chronologicalCode: { contains: term, mode: 'insensitive' },
    }),
  },
  where: {
    and: (clauses) => ({ AND: [...clauses] }),
    or: (clauses) => ({ OR: [...clauses] }),
  },
});
