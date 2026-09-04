// src/modules/prisma/seeders/permission.seeder.ts

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, Role } from 'generated/prisma/client';
import { AppError } from 'exceptions/app.exception';
import data from '../data/permissions.json';
import { PrismaService } from '../services/prisma.service';
import { parsePermissionSeedData } from './schemas/permission-seed.schema';

export interface PermissionSeedResult {
  readonly permissions: number;
  readonly assignments: number;
}

@Injectable()
export class PermissionSeeder {
  private readonly context = PermissionSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async seed(
    roles: readonly Role[],
    tx?: Prisma.TransactionClient,
  ): Promise<PermissionSeedResult> {
    const prismaClient = tx ?? this.prisma;

    try {
      const seedData = parsePermissionSeedData(data);
      const rolesByName = new Map(
        roles.map((role) => [role.name, role] as const),
      );

      /**
       * ------------------------------------------------------------
       * 1. Create/update permission definitions
       * ------------------------------------------------------------
       */
      const permissionIds = new Map<string, number>();

      for (const permission of seedData.permissions) {
        // const record = await prismaClient.permission.upsert({
        //   where: {
        //     action_subject: {
        //       action: permission.action,
        //       subject: permission.subject,
        //     },
        //   },
        //   update: {},
        //   create: {
        //     action: permission.action,
        //     subject: permission.subject,
        //   },
        // });

        const existingPermission = await prismaClient.permission.findUnique({
          where: {
            action_subject: {
              action: permission.action,
              subject: permission.subject,
            },
          },
          select: {
            id: true,
          },
        });

        const record =
          existingPermission ??
          (await prismaClient.permission.create({
            data: {
              action: permission.action,
              subject: permission.subject,
            },
          }));

        permissionIds.set(
          `${permission.action}:${permission.subject}`,
          record.id,
        );
      }

      /**
       * ------------------------------------------------------------
       * 2. Synchronize seeded role assignments
       * ------------------------------------------------------------
       *
       * For roles represented in permissions.json, that JSON becomes
       * the exact baseline matrix.
       *
       * This means removing a grant from the seed file actually
       * revokes that seeded grant the next time seeding runs.
       */
      let assignmentCount = 0;

      for (const roleAssignment of seedData.roles) {
        const role = rolesByName.get(roleAssignment.role);

        if (!role) {
          throw new Error(
            `Permission seed references unknown role "${roleAssignment.role}".`,
          );
        }

        const desiredPermissionIds: number[] = [];

        for (const permission of roleAssignment.permissions) {
          const permissionId = permissionIds.get(
            `${permission.action}:${permission.subject}`,
          );

          if (permissionId === undefined) {
            throw new Error(
              `Permission "${permission.action}:${permission.subject}" was not resolved.`,
            );
          }

          desiredPermissionIds.push(permissionId);
        }

        /**
         * Remove stale baseline assignments.
         */
        await prismaClient.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            ...(desiredPermissionIds.length > 0
              ? {
                  permissionId: {
                    notIn: desiredPermissionIds,
                  },
                }
              : {}),
          },
        });

        /**
         * Recreate/verify desired assignments.
         */
        for (const permissionId of desiredPermissionIds) {
          await prismaClient.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId,
              },
            },

            update: {},
            create: {
              roleId: role.id,
              permissionId,
            },
          });

          assignmentCount += 1;
        }
      }

      const result: PermissionSeedResult = {
        permissions: permissionIds.size,
        assignments: assignmentCount,
      };

      this.logger.log(
        `✅ Authorization seed completed: ${result.permissions} permissions, ${result.assignments} role assignments.`,
      );

      return result;
    } catch (error: unknown) {
      this.logger.error('CRITICAL: Permission seeding failed.', error);

      throw new AppError(
        'Failed to seed authorization permissions.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }
}
