// src/modules/users/data-table/user-data-table.prisma.ts

import type { Prisma } from 'generated/prisma/client';
import {
  createDataTablePrismaTranslator,
  type DataTablePrismaDefaultOrderBy,
} from 'common/data-table';
import { userDataTablePolicy } from './user-data-table.policy';

/**
 * Stable default ordering for offset pagination.
 */
export const USER_DATA_TABLE_DEFAULT_ORDER_BY = [
  { name: 'asc' },
  { id: 'asc' },
] as const satisfies DataTablePrismaDefaultOrderBy<Prisma.UserOrderByWithRelationInput>;

export const userDataTablePrismaTranslator = createDataTablePrismaTranslator<
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput
>()({
  policy: userDataTablePolicy,

  sorting: {
    id: (direction) => ({ id: direction }),
    name: (direction) => ({ name: direction }),
    email: (direction) => ({ email: direction }),
    username: (direction) => ({ username: direction }),
    roleId: (direction) => ({ roleId: direction }),
    createdAt: (direction) => ({ createdAt: direction }),
    updatedAt: (direction) => ({ updatedAt: direction }),
    isEnabled: (direction) => ({ isEnabled: direction }),
  },

  filtering: {
    id: {
      equals: (value) => ({ id: { equals: value } }),
      in: (value) => ({ id: { in: [...value] } }),
    },

    name: {
      equals: (value) => ({
        name: { equals: value, mode: 'insensitive' },
      }),
      contains: (value) => ({
        name: { contains: value, mode: 'insensitive' },
      }),
    },

    email: {
      equals: (value) => ({
        email: { equals: value, mode: 'insensitive' },
      }),
      contains: (value) => ({
        email: { contains: value, mode: 'insensitive' },
      }),
    },

    username: {
      equals: (value) => ({
        username: { equals: value, mode: 'insensitive' },
      }),
      contains: (value) => ({
        username: { contains: value, mode: 'insensitive' },
      }),
    },

    roleId: {
      equals: (value) => ({ roleId: { equals: value } }),
      in: (value) => ({ roleId: { in: [...value] } }),
    },

    isEnabled: {
      equals: (value) => ({ isEnabled: { equals: value } }),
    },

    isLocked: {
      equals: (value) => ({ isLocked: { equals: value } }),
    },

    isActivated: {
      equals: (value) => ({ isActivated: { equals: value } }),
    },

    banned: {
      equals: (value) => ({ banned: { equals: value } }),
    },
  },

  search: {
    name: (term) => ({
      name: { contains: term, mode: 'insensitive' },
    }),

    email: (term) => ({
      email: { contains: term, mode: 'insensitive' },
    }),

    username: (term) => ({
      username: { contains: term, mode: 'insensitive' },
    }),
  },

  where: {
    and: (clauses) => ({ AND: [...clauses] }),
    or: (clauses) => ({ OR: [...clauses] }),
  },
});
