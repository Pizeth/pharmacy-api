// src/modules/users/data-table/user-data-table.select.ts

import type { Prisma } from 'generated/prisma/client';

/**
 * Canonical administrative User DataTable projection.
 *
 * Sensitive authentication/session fields are intentionally excluded.
 */
export const USER_DATA_TABLE_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  image: true,
  role: true,
  roleId: true,
  isEnabled: true,
  isLocked: true,
  isActivated: true,
  banned: true,
  profileComplete: true,
  isLinked: true,
  createdAt: true,
  updatedAt: true,
  userRole: {
    select: {
      id: true,
      name: true,
    },
  },
} as const satisfies Prisma.UserSelect;
