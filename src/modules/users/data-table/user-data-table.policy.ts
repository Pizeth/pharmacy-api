// src/modules/users/data-table/user-data-table.policy.ts

import { z } from 'zod';
import {
  createDataTableQueryPolicy,
  DATA_TABLE_MAX_FILTER_STRING_LENGTH,
} from 'common/data-table';

/**
 * User DataTable resource policy.
 *
 * Public field names are intentionally mapped through this policy before any
 * Prisma expression is created.
 */
const userIdSchema = z.number().int().positive();

const userTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(DATA_TABLE_MAX_FILTER_STRING_LENGTH);

const userBooleanSchema = z.boolean();

export const userDataTablePolicy = createDataTableQueryPolicy({
  sorting: {
    id: { target: 'id' },
    name: { target: 'name' },
    email: { target: 'email' },
    username: { target: 'username' },
    roleId: { target: 'roleId' },
    createdAt: { target: 'createdAt' },
    updatedAt: { target: 'updatedAt' },
    isEnabled: { target: 'isEnabled' },
  },

  filtering: {
    id: {
      target: 'id',
      operators: ['equals', 'in'],
      values: {
        equals: userIdSchema,
        in: z.array(userIdSchema).min(1),
      },
    },

    name: {
      target: 'name',
      operators: ['equals', 'contains'],
      values: {
        equals: userTextSchema,
        contains: userTextSchema,
      },
    },

    email: {
      target: 'email',
      operators: ['equals', 'contains'],
      values: {
        equals: userTextSchema,
        contains: userTextSchema,
      },
    },

    username: {
      target: 'username',
      operators: ['equals', 'contains'],
      values: {
        equals: userTextSchema,
        contains: userTextSchema,
      },
    },

    roleId: {
      target: 'roleId',
      operators: ['equals', 'in'],
      values: {
        equals: userIdSchema,
        in: z.array(userIdSchema).min(1),
      },
    },

    isEnabled: {
      target: 'isEnabled',
      operators: ['equals'],
      values: {
        equals: userBooleanSchema,
      },
    },

    isLocked: {
      target: 'isLocked',
      operators: ['equals'],
      values: {
        equals: userBooleanSchema,
      },
    },

    isActivated: {
      target: 'isActivated',
      operators: ['equals'],
      values: {
        equals: userBooleanSchema,
      },
    },

    banned: {
      target: 'banned',
      operators: ['equals'],
      values: {
        equals: userBooleanSchema,
      },
    },
  },

  /**
   * Browser global search sends only a term.
   *
   * Searchable fields remain server-owned policy.
   */
  search: {
    targets: ['name', 'email', 'username'],
  },
});

export type UserDataTablePolicy = typeof userDataTablePolicy;
