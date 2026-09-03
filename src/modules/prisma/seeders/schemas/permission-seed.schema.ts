// src/modules/prisma/seeders/schemas/permission-seed.schema.ts

import { z } from 'zod';
import { appActionSchema, appSubjectSchema } from 'modules/authorization';

export const permissionSeedReferenceSchema = z.strictObject({
  action: appActionSchema,
  subject: appSubjectSchema,
});

export const permissionSeedRoleSchema = z.strictObject({
  role: z.string().trim().min(1).max(50),
  permissions: z.array(permissionSeedReferenceSchema),
});

const permissionSeedBaseSchema = z.strictObject({
  permissions: z.array(permissionSeedReferenceSchema).min(1),
  roles: z.array(permissionSeedRoleSchema).min(1),
});

function permissionKey(permission: {
  readonly action: string;
  readonly subject: string;
}): string {
  return `${permission.action}:${permission.subject}`;
}

export const permissionSeedDataSchema = permissionSeedBaseSchema.superRefine(
  (data, context) => {
    const declaredPermissions = new Set<string>();

    data.permissions.forEach((permission, index) => {
      const key = permissionKey(permission);

      if (declaredPermissions.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['permissions', index],
          message: `Duplicate permission "${key}".`,
        });

        return;
      }

      declaredPermissions.add(key);
    });

    const declaredRoles = new Set<string>();

    data.roles.forEach((role, roleIndex) => {
      if (declaredRoles.has(role.role)) {
        context.addIssue({
          code: 'custom',
          path: ['roles', roleIndex, 'role'],
          message: `Duplicate role permission assignment "${role.role}".`,
        });
      } else {
        declaredRoles.add(role.role);
      }

      const rolePermissions = new Set<string>();

      role.permissions.forEach((permission, permissionIndex) => {
        const key = permissionKey(permission);

        if (!declaredPermissions.has(key)) {
          context.addIssue({
            code: 'custom',
            path: ['roles', roleIndex, 'permissions', permissionIndex],
            message: `Role "${role.role}" references undeclared permission "${key}".`,
          });
        }

        if (rolePermissions.has(key)) {
          context.addIssue({
            code: 'custom',
            path: ['roles', roleIndex, 'permissions', permissionIndex],
            message: `Role "${role.role}" contains duplicate permission "${key}".`,
          });
        } else {
          rolePermissions.add(key);
        }
      });
    });
  },
);

export type PermissionSeedData = z.output<typeof permissionSeedDataSchema>;

export function parsePermissionSeedData(input: unknown): PermissionSeedData {
  return z.parse(permissionSeedDataSchema, input);
}
