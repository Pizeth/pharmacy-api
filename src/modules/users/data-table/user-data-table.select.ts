import type { Prisma } from "generated/prisma/client";

/**
 * Canonical row projection for the Users DataTable.
 *
 * Keep this intentionally narrower than the complete authentication user
 * record. The administration list does not need session/account secrets or
 * other relation-heavy state.
 */
export const USER_DATA_TABLE_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  image: true,
  isEnabled: true,
  banned: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;
