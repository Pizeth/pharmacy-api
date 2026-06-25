import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { SuperAdminData } from 'types/seed';
import { Prisma, Role } from 'generated/prisma/client';
import { AuditActionType, AuditTargetType, Sex } from 'types/commons.enum';
import { v7 as uuid7 } from 'uuid';
import { UserDetail } from 'types/dto';
import { AppError } from 'exceptions/app.exception';
import { hashPassword } from 'better-auth/crypto';

@Injectable()
export class UserSeeder {
  private readonly context = UserSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    this.logger.debug('UserSeeder constructor called');
    this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
    this.logger.debug(`ConfigService injected: ${!!this.config}`);
  }

  async seed(
    roles: Role[],
    tx?: Prisma.TransactionClient,
  ): Promise<UserDetail> {
    this.logger.log('🌱 Executing system administration data seeding...');

    const prismaClient = tx || this.prisma; // Use the provided tx or the default client
    const superAdminData = this.getSuperAdminData(roles);

    // 1. Generate hash strictly aligned with Better Auth's scrypt config rules
    // ✅ Clean, independent, and error-free password hashing
    const hashedAdminPassword = await hashPassword(superAdminData.password);

    try {
      // Step 1: Upsert the super admin baseline configuration
      const superAdmin = await prismaClient.user.upsert({
        where: { email: superAdminData.email },
        update: {
          roleId: superAdminData.roleId,
          role: 'sys-admin', // Sync string fallback for Better-Auth admin utilities
        },
        create: {
          name: superAdminData.username,
          email: superAdminData.email,
          image: superAdminData.avatar,
          role: 'sys-admin', // Kept for default admin() plugin compliance
          roleId: superAdminData.roleId,
          emailVerified: true,
          isActivated: true,
          mustChangePassword: true, // Force change on login
          // Using nested writes for related data.
          profile: {
            create: {
              firstName: superAdminData.profile.firstName,
              lastName: superAdminData.profile.lastName,
              sex: superAdminData.profile.sex,
              dob: new Date(superAdminData.profile.dob),
              pob: superAdminData.profile.pob,
              address: superAdminData.profile.address,
              phone: superAdminData.profile.phone,
              married: superAdminData.profile.married,
              bio: superAdminData.profile.bio || '',
              createdBy: 0, // Placeholder for audit field.
              updatedBy: 0, // Placeholder (will be replaced).
            },
          },
          createdBy: 0, // Placeholder.
          updatedBy: 0, // Placeholder.
          auditTrail: {
            create: {
              action: AuditActionType.CREATE,
              targetType: AuditTargetType.User,
              targetId: '0', // Placeholder.
              userAgent: 'SYSTEM',
              timestamp: new Date(),
              ipAddress: 'LOCALHOST',
              description: 'DEFAULT_SUPER_ADMIN_INITIAL_SEED',
            },
          },
        },
        include: {
          userRole: true,
          profile: true,
          auditTrail: true,
        },
      });

      // Step 2: Update the just created user with its own id for audit fields.
      const userId = superAdmin.id;

      console.log('superAdmin', superAdmin);

      // Locate the newly generated audit trail entry using targetId placeholder mapping
      const targetingAudit = superAdmin.auditTrail.find(
        (audit) => audit.targetId === '0',
      );

      if (!targetingAudit) {
        throw new Error(
          'Crucial system seeding audit tracking trail entry missing.',
        );
      }

      // Step 3: Fix placeholder properties with the authentic autoincremented entity userID
      const updatedSuperAdmin = await prismaClient.user.update({
        where: { id: userId },
        data: {
          createdBy: userId,
          updatedBy: userId,
          profile: {
            update: {
              createdBy: userId,
              updatedBy: userId,
            },
          },
          // ✅ CREATE THE ACCOUNT HERE NATIVELY
          accounts: {
            create: {
              accountId: String(userId), // Standard Better-Auth structural convention for credential tracking
              password: hashedAdminPassword,
              providerId: 'credential',
            },
          },
          auditTrail: {
            update: {
              where: {
                id: targetingAudit.id,
              },
              data: {
                targetId: String(userId),
                oldValues: superAdmin,
                sessionId: uuid7(),
              },
            },
          },
        },
        include: {
          userRole: true,
          profile: true,
          accounts: true,
          auditTrail: true,
        },
      });

      // Step 4: Self-correct any roles generated before the master administrator existed
      await prismaClient.role.updateMany({
        where: { createdBy: 1, updatedBy: 1 },
        data: { createdBy: userId, updatedBy: userId },
      });

      this.logger.log('🌱 Super Admin user seeded successfully:', {
        id: updatedSuperAdmin.id,
        email: updatedSuperAdmin.email,
        userRole: updatedSuperAdmin.userRole,
        accounts: updatedSuperAdmin.accounts,
        profile: updatedSuperAdmin.profile,
        // Be careful logging tokens, even in seeds
      });

      const adminRole = roles.find((role) => role.name === 'SUPER_ADMIN');
      if (!adminRole) {
        throw new Error('SUPER_ADMIN role not found after seeding roles.');
      }

      this.logger.log(
        `✅ Super admin created/verified: ${updatedSuperAdmin.email}`,
      );

      // Format return data to perfectly conform with target UserDetail DTO requirements
      return updatedSuperAdmin as unknown as UserDetail;
    } catch (error) {
      this.logger.error(
        'CRITICAL: UserSeeder pipeline failure encountered',
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // The `error.code` is a known error code
        if (error.code === 'P2025') {
          this.logger.error(
            'Nested update failed: Record to update not found.',
            error.message,
          );
          // Handle the specific error, e.g., send a 404 response
          // throw new Error('Post not found for update.');
        } else {
          // Handle other Prisma errors
          this.logger.error(
            'An unexpected Prisma error occurred:',
            error.message,
          );
        }
      } else {
        // Handle other potential errors
        console.error('An unexpected error occurred:', error);
        this.logger.error(
          `An unexpected error occurred, failed to seed Super Admin ${roles.map((r) => r.name).join(', ')}:`,
          error,
        );
      }

      throw new AppError(
        'Failed to seed Super Admin execution payload tracking arrays.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  private getSuperAdminRole(roles: Role[], roleName: string): Role {
    const matchedRole = roles.find((role) => role.name === roleName);
    if (matchedRole) return matchedRole;

    if (roles.length > 0) return roles[0];

    throw new Error(
      `Fatal Seeding Failure: No active database authorization roles available.`,
    );
  }

  private getSuperAdminData(roles: Role[]): SuperAdminData {
    const role = this.getSuperAdminRole(roles, 'SUPER_ADMIN');
    // const adminRole = roles.find((role) => role.name === 'SUPER_ADMIN');
    if (!role) {
      throw new Error('SUPER_ADMIN role not found after seeding roles.');
    }

    return {
      username: this.config.get('SEED_ADMIN_USERNAME', 'razeth'),
      email: this.config.get('SEED_ADMIN_EMAIL', 'seth.razeth@gmail.com'),
      password: this.config.get('SEED_ADMIN_PASSWORD', 'Kokakola1!'),
      roleId: role?.id || 1,
      role: role,
      avatar: this.config.get(
        'SEED_ADMIN_AVATAR',
        'https://i.pinimg.com/736x/36/08/fe/3608fede746d1d6b429e58b945a90e1a.jpg',
      ),
      authMethod: [this.config.get('SEED_ADMIN_AUTH_METHOD', 'credential')],
      profile: {
        firstName: this.config.get('SEED_ADMIN_FIRST_NAME', 'Piseth'),
        lastName: this.config.get('SEED_ADMIN_LAST_NAME', 'Mam'),
        sex: this.config.get('SEED_ADMIN_SEX', Sex.MALE),
        dob: this.config.get('SEED_ADMIN_DOB', '1993-07-20'),
        pob: this.config.get('SEED_ADMIN_POB', 'ព្រៃវែង'),
        address: this.config.get('SEED_ADMIN_ADDRESS', 'ភ្នំពេញ'),
        phone: this.config.get('SEED_ADMIN_PHONE', '015 69 79 27'),
        married: this.config.get('SEED_ADMIN_MARRIED', 'true') === 'true',
        bio: this.config.get('SEED_ADMIN_BIO', ''),
      },
    };
  }
}
