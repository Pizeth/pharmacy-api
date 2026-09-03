// src/modules/authorization/casl/casl-ability.factory.ts

import { Injectable, Logger } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { PrismaService } from 'modules/prisma/services/prisma.service';

import { appActionSchema, appSubjectSchema } from './app-ability';

import type { AppAbility } from './app-ability';

@Injectable()
export class CaslAbilityFactory {
  private readonly logger = new Logger(CaslAbilityFactory.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Construct one user's effective authorization ability.
   *
   * Current source:
   *
   * User
   *  ↓
   * Role
   *  ↓
   * RolePermission
   *  ↓
   * Permission
   *
   * Later this method can additionally derive contextual/conditional
   * abilities without changing controller decorators.
   */
  async createForUser(userId: number): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    /**
     * Load only what authorization needs.
     *
     * Do not fetch the complete User/Profile/Account graph merely to
     * construct an ability.
     */
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        userRole: {
          select: {
            id: true,
            name: true,
            isEnabled: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    action: true,
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    /**
     * Fail closed.
     *
     * Authentication and authorization are separate concerns:
     *
     * Better Auth may know the session, but an inactive/locked user
     * receives no application authorization.
     *
     * A missing/disabled user or role simply receives an empty
     * ability.
     */
    if (
      !user ||
      user.isEnabled === false ||
      user.isLocked === true ||
      user.isActivated === false ||
      !user.userRole ||
      !user.userRole.isEnabled
    ) {
      return build();
    }

    for (const rolePermission of user.userRole.permissions) {
      const permission = rolePermission.permission;

      /**
       * Permission.action/subject are database strings.
       *
       * Never blindly cast database strings into CASL types.
       *
       * Parse them at the trust boundary and fail closed when an
       * invalid permission row is encountered.
       */
      const actionResult = appActionSchema.safeParse(permission.action);

      const subjectResult = appSubjectSchema.safeParse(permission.subject);

      if (!actionResult.success || !subjectResult.success) {
        this.logger.warn(
          `Ignoring invalid authorization permission row: action="${permission.action}", subject="${permission.subject}".`,
        );

        continue;
      }

      can(actionResult.data, subjectResult.data);
    }

    return build();
  }
}
