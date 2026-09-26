// src/modules/users/data-table/user-data-table.types.ts

import type { Prisma } from 'generated/prisma/client';
import type { PaginatedDataResult } from 'types/types';
import { USER_DATA_TABLE_SELECT } from './user-data-table.select';

export type UserDataTableRow = Prisma.UserGetPayload<{
  select: typeof USER_DATA_TABLE_SELECT;
}>;

export type UserDataTableResult = PaginatedDataResult<UserDataTableRow>;
