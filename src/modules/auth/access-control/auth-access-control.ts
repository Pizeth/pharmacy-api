// src/modules/auth/access-control/auth-access-control.ts

import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

/**
 * ------------------------------------------------------------------
 * Application-wide Better Auth permission statement
 * ------------------------------------------------------------------
 *
 * Better Auth's admin plugin already owns resources such as:
 *
 *   user
 *   session
 *
 * We preserve those statements and add our own application resources.
 */
export const authStatement = {
  ...defaultStatements,

  /**
   * Translation administration.
   *
   * These action names intentionally match our Nest decorators:
   *
   *   translation:create
   *   translation:read
   *   translation:update
   *   translation:delete
   */
  translation: ['create', 'read', 'update', 'delete'],
} as const;

/**
 * Central Better Auth access-control instance.
 */
export const authAccessControl = createAccessControl(authStatement);

/**
 * ------------------------------------------------------------------
 * Better Auth roles
 * ------------------------------------------------------------------
 */

/**
 * Normal application user.
 *
 * No application-admin permissions are granted here.
 */
export const userAuthRole = authAccessControl.newRole({});

/**
 * Standard administrator.
 *
 * Preserve Better Auth's built-in administrator capabilities and give
 * the administrator complete Translation administration access.
 */
export const adminAuthRole = authAccessControl.newRole({
  ...adminAc.statements,
  translation: ['create', 'read', 'update', 'delete'],
});

/**
 * System/Super administrator.
 *
 * IMPORTANT:
 *
 * The registry key used later is exactly:
 *
 *   "sys-admin"
 *
 * because your UserSeeder stores:
 *
 *   user.role = "sys-admin"
 */
export const systemAdminAuthRole = authAccessControl.newRole({
  ...adminAc.statements,
  translation: ['create', 'read', 'update', 'delete'],
});

/**
 * Better Auth role registry.
 *
 * Keys here must match User.role exactly.
 */
export const authRoles = {
  user: userAuthRole,
  admin: adminAuthRole,
  'sys-admin': systemAdminAuthRole,
} as const;
