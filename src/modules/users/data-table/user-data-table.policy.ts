import { z } from "zod";

import {
  createDataTableQueryPolicy,
  DATA_TABLE_MAX_FILTER_STRING_LENGTH,
} from "common/data-table";

/**
 * User-table filter text.
 *
 * Resource policy is the correct place to narrow generic DataTable values
 * into the actual semantics accepted by this resource.
 */
const userFilterTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(DATA_TABLE_MAX_FILTER_STRING_LENGTH);

const userIdSchema = z.number().int().positive();
const userIdListSchema = z.array(userIdSchema).min(1);

/**
 * Public User DataTable query policy.
 *
 * Browser-facing field names remain deliberately independent from Prisma.
 */
export const userDataTablePolicy = createDataTableQueryPolicy({
  sorting: {
    id: {
      target: "id",
    },
    name: {
      target: "name",
    },
    email: {
      target: "email",
    },
    username: {
      target: "username",
    },
    role: {
      target: "role",
    },
    createdAt: {
      target: "createdAt",
    },
    updatedAt: {
      target: "updatedAt",
    },
  },

  filtering: {
    id: {
      target: "id",
      operators: ["equals", "in"],
      values: {
        equals: userIdSchema,
        in: userIdListSchema,
      },
    },
    name: {
      target: "name",
      operators: ["equals", "contains"],
      values: {
        equals: userFilterTextSchema,
        contains: userFilterTextSchema,
      },
    },
    email: {
      target: "email",
      operators: ["equals", "contains"],
      values: {
        equals: userFilterTextSchema,
        contains: userFilterTextSchema,
      },
    },
    username: {
      target: "username",
      operators: ["equals", "contains"],
      values: {
        equals: userFilterTextSchema,
        contains: userFilterTextSchema,
      },
    },
    role: {
      target: "role",
      operators: ["equals", "contains"],
      values: {
        equals: userFilterTextSchema,
        contains: userFilterTextSchema,
      },
    },
    isEnabled: {
      target: "isEnabled",
      operators: ["equals"],
      values: {
        equals: z.boolean(),
      },
    },
    banned: {
      target: "banned",
      operators: ["equals"],
      values: {
        equals: z.boolean(),
      },
    },
  },

  /**
   * Search targets are server-owned.
   *
   * The browser supplies only the term.
   */
  search: {
    targets: ["name", "email", "username"],
  },
});

export type UserDataTablePolicy = typeof userDataTablePolicy;
