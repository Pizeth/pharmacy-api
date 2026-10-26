import { z } from 'zod';
import type { Prisma } from 'generated/prisma/client';
import {
  createDataTableQueryPolicy,
  createDataTablePrismaTranslator,
} from 'common/data-table';
const text = z.string().trim().min(1).max(500);
export const userDataTablePolicy = createDataTableQueryPolicy({
  sorting: {
    name: { target: 'name' },
    email: { target: 'email' },
    role: { target: 'roleName' },
    banned: { target: 'banned' },
  },
  filtering: {
    name: {
      target: 'name',
      operators: ['contains', 'equals'],
      values: { contains: text, equals: text },
    },
    email: {
      target: 'email',
      operators: ['contains', 'equals'],
      values: { contains: text, equals: text },
    },
    role: {
      target: 'roleId',
      operators: ['equals'],
      values: { equals: z.number().int().positive() },
    },
    banned: {
      target: 'banned',
      operators: ['equals'],
      values: { equals: z.boolean() },
    },
  },
  search: { targets: ['name', 'email', 'username'] },
});
export const userDataTableTranslator = createDataTablePrismaTranslator<
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput
>()({
  policy: userDataTablePolicy,
  sorting: {
    name: (direction) => ({ name: direction }),
    email: (direction) => ({ email: direction }),
    roleName: (direction) => ({ userRole: { name: direction } }),
    banned: (direction) => ({ banned: direction }),
  },
  filtering: {
    name: {
      contains: (value) => ({ name: { contains: value, mode: 'insensitive' } }),
      equals: (value) => ({ name: { equals: value, mode: 'insensitive' } }),
    },
    email: {
      contains: (value) => ({
        email: { contains: value, mode: 'insensitive' },
      }),
      equals: (value) => ({ email: { equals: value, mode: 'insensitive' } }),
    },
    roleId: { equals: (value) => ({ roleId: value }) },
    banned: {
      equals: (value) =>
        value
          ? { banned: true }
          : { OR: [{ banned: false }, { banned: null }] },
    },
  },
  search: {
    name: (term) => ({ name: { contains: term, mode: 'insensitive' } }),
    email: (term) => ({ email: { contains: term, mode: 'insensitive' } }),
    username: (term) => ({ username: { contains: term, mode: 'insensitive' } }),
  },
  where: {
    and: (clauses) => ({ AND: [...clauses] }),
    or: (clauses) => ({ OR: [...clauses] }),
  },
});
export const USER_TABLE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  username: true,
  role: true,
  roleId: true,
  banned: true,
  emailVerified: true,
} satisfies Prisma.UserSelect;
