import type { Prisma } from "generated/prisma/client";

import {
  createDataTablePrismaTranslator,
  type DataTablePrismaDefaultOrderBy,
} from "common/data-table";
import { userDataTablePolicy } from "./user-data-table.policy";

/**
 * Deterministic default ordering for the Users administration table.
 */
export const USER_DATA_TABLE_DEFAULT_ORDER_BY = [
  {
    createdAt: "desc",
  },
  {
    id: "asc",
  },
] as const satisfies DataTablePrismaDefaultOrderBy<Prisma.UserOrderByWithRelationInput>;

export const userDataTablePrismaTranslator =
  createDataTablePrismaTranslator<
    Prisma.UserWhereInput,
    Prisma.UserOrderByWithRelationInput
  >()({
    policy: userDataTablePolicy,

    sorting: {
      id: (direction) => ({
        id: direction,
      }),
      name: (direction) => ({
        name: direction,
      }),
      email: (direction) => ({
        email: direction,
      }),
      username: (direction) => ({
        username: direction,
      }),
      role: (direction) => ({
        role: direction,
      }),
      createdAt: (direction) => ({
        createdAt: direction,
      }),
      updatedAt: (direction) => ({
        updatedAt: direction,
      }),
    },

    filtering: {
      id: {
        equals: (value) => ({
          id: {
            equals: value,
          },
        }),
        in: (value) => ({
          id: {
            in: [...value],
          },
        }),
      },

      name: {
        equals: (value) => ({
          name: {
            equals: value,
            mode: "insensitive",
          },
        }),
        contains: (value) => ({
          name: {
            contains: value,
            mode: "insensitive",
          },
        }),
      },

      email: {
        equals: (value) => ({
          email: {
            equals: value,
            mode: "insensitive",
          },
        }),
        contains: (value) => ({
          email: {
            contains: value,
            mode: "insensitive",
          },
        }),
      },

      username: {
        equals: (value) => ({
          username: {
            equals: value,
            mode: "insensitive",
          },
        }),
        contains: (value) => ({
          username: {
            contains: value,
            mode: "insensitive",
          },
        }),
      },

      role: {
        equals: (value) => ({
          role: {
            equals: value,
            mode: "insensitive",
          },
        }),
        contains: (value) => ({
          role: {
            contains: value,
            mode: "insensitive",
          },
        }),
      },

      isEnabled: {
        equals: (value) => ({
          isEnabled: {
            equals: value,
          },
        }),
      },

      banned: {
        equals: (value) => ({
          banned: {
            equals: value,
          },
        }),
      },
    },

    search: {
      name: (term) => ({
        name: {
          contains: term,
          mode: "insensitive",
        },
      }),
      email: (term) => ({
        email: {
          contains: term,
          mode: "insensitive",
        },
      }),
      username: (term) => ({
        username: {
          contains: term,
          mode: "insensitive",
        },
      }),
    },

    where: {
      and: (clauses) => ({
        AND: [...clauses],
      }),
      or: (clauses) => ({
        OR: [...clauses],
      }),
    },
  });
