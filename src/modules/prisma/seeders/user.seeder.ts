import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { SuperAdminData } from 'types/seed';
import {
  AuditTrail,
  Prisma,
  // RefreshToken,
  Role,
} from 'generated/prisma/client';
// import { TokenService } from 'src/commons/services/token.service';
// import { PasswordUtils } from 'src/commons/services/password-utils.service';
// import { RoleToken } from 'types/token';
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
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    // 1. Generate hash strictly aligned with Better Auth's scrypt config rules
    // ✅ Clean, independent, and error-free password hashing
    const adminRawPassword = this.config.get<string>(
      'SEED_ADMIN_PASSWORD',
      'Kokakola1!',
    );
    const hashedAdminPassword = await hashPassword(adminRawPassword);

    this.logger.debug(`PrismaService resolved: ${!!this.prisma}`);
    this.logger.debug(`ConfigService resolved: ${!!this.config}`);

    const prismaClient = tx || this.prisma; // Use the provided tx or the default client
    const superAdminData = this.getSuperAdminData(roles);
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
          // password: await this.passwordUtils.hash(superAdminData.password),
          image: superAdminData.avatar,
          role: 'sys-admin', // Kept for default admin() plugin compliance
          roleId: superAdminData.roleId,
          emailVerified: true,
          isActivated: true,
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
              lastUpdatedBy: 0, // Placeholder (will be replaced).
            },
          },
          createdBy: 0, // Placeholder.
          lastUpdatedBy: 0, // Placeholder.
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

      // const { auditTrail, /*refreshTokens,*/ ...user } = superAdmin;
      // Locate the newly generated audit trail entry using targetId placeholder mapping
      const targetingAudit = superAdmin.auditTrail.find(
        (audit) => audit.targetId === '0',
      );

      if (!targetingAudit) {
        throw new Error(
          'Crucial system seeding audit tracking trail entry missing.',
        );
      }

      // const auditTrailId = this.getSeedAudit(auditTrail, userId, '0');
      // this.logger.debug('Audit trail ID', auditTrailId);

      // if (!refreshTokenId || !auditTrailId) return superAdmin;

      // const updatedRoles = await prismaClient.role.updateManyAndReturn({
      //   where: { createdBy: 0, lastUpdatedBy: 0 }, //Roles that was created using Placeholder
      //   data: { createdBy: userId, lastUpdatedBy: userId },
      // });

      // Step 2: Fix placeholder properties with the authentic autoincremented entity userID
      const updatedSuperAdmin = await prismaClient.user.update({
        where: { id: userId },
        data: {
          createdBy: userId,
          lastUpdatedBy: userId,
          profile: {
            update: {
              createdBy: userId,
              lastUpdatedBy: userId,
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
          // (Optionally) update refreshTokens if they need to reference the user's id.
          // refreshTokens: {
          //   update: {
          //     where: {
          //       id: refreshTokenId,
          //     },
          //     data: {
          //       token: await this.token.generateToken(
          //         {
          //           sub: userId,
          //           username: superAdmin.username,
          //           email: superAdmin.email,
          //           role: this.getRoleToken(superAdmin.role),
          //           avatar: superAdmin.avatar,
          //           authMethod: superAdmin.authMethod,
          //           ip: 'LOCALHOST',
          //         },
          //         '7d',
          //       ),
          //     },
          //   },
          // },
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

      // // If you need the actual userId for the token after creation and it's not 1
      // if (
      //   updatedRoles.every(
      //     (role) => role.createdBy !== userId || role.lastUpdatedBy !== userId,
      //   ) ||
      //   (updatedSuperAdmin.refreshTokens.length > 0 &&
      //     updatedSuperAdmin.refreshTokens.find(
      //       (token) => token.userId !== userId,
      //     ))
      // ) {
      //   this.logger.log(
      //     `Admin user created/found with ID: ${userId}. Initial token was for placeholder ID.`,
      //   );
      //   // Optionally, you could update the token here if userId is crucial for its payload
      //   // and different from a hardcoded one. For simplicity, this step is often skipped in basic seeds.
      // }

      // return updatedSuperAdmin;
      // });

      // Step 3: Self-correct any roles generated before the master administrator existed
      await prismaClient.role.updateMany({
        where: { createdBy: 1, lastUpdatedBy: 1 },
        data: { createdBy: userId, lastUpdatedBy: userId },
      });

      this.logger.log('🌱 Super Admin user seeded successfully:', {
        id: updatedSuperAdmin.id,
        email: updatedSuperAdmin.email,
        userRole: updatedSuperAdmin.userRole,
        accounts: updatedSuperAdmin.accounts,
        profile: updatedSuperAdmin.profile,
        // Be careful logging tokens, even in seeds
        // refreshTokenId: adminUser.refreshTokens.length > 0 ? adminUser.refreshTokens[0].id : null
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

  // private getRoleToken(role: Role): RoleToken {
  //   if (!role) {
  //     return {
  //       id: 0,
  //       name: 'SUPER_ADMIN',
  //       description: 'Super Administrator with full access',
  //     };
  //   }
  //   return {
  //     id: role.id,
  //     name: role.name,
  //     description: role.description,
  //   };
  // }

  // private getSeedToken(
  //   refreshTokens: RefreshToken[],
  //   id: number,
  //   expiresAt: Date,
  // ): number | undefined {
  //   return refreshTokens.find(
  //     (token) =>
  //       token.userId === id &&
  //       token.expiresAt.getTime() === expiresAt.getTime(),
  //   )?.id;
  // }

  // private getSeedAudit(
  //   auditTrail: AuditTrail[],
  //   id: number,
  //   targetId: string,
  // ): number | undefined {
  //   return auditTrail.find(
  //     (audit) => audit.userId === id && audit.targetId === targetId,
  //   )?.id;
  // }

  private getSuperAdminRole(roles: Role[], roleName: string): Role {
    // return (
    //   roles.find((role) => role.name === roleName) ||
    //   (roles.length > 0
    //     ? roles[0]
    //     : {
    //         id: 1,
    //         name: 'SUPER_ADMIN',
    //         description: 'Super Administrator Role',
    //         isEnabled: true,
    //         createdBy: 0,
    //         createdDate: new Date(),
    //         lastUpdatedBy: 0,
    //         lastUpdatedDate: new Date(),
    //         objectVersionId: 1,
    //       })
    // );

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

// async seed(roles: Role[]) {
//   const superAdminData = this.getSuperAdminData(roles);

//   const superAdmin = await this.prisma.user.upsert({
//     where: { email: superAdminData.email },
//     update: {
//       // Add fields to update if the user already exists
//       // For example, ensure role is SUPER_ADMIN or update last login
//       roleId: superAdminData.roleId,
//       lastUpdatedBy: 1, // Assuming a system user or the user itself
//     }, // Don't update if exists
//     create: {
//       username: superAdminData.username,
//       email: superAdminData.email,
//       password: await this.hashPassword(superAdminData.password),
//       avatar: superAdminData.avatar,
//       roleId: superAdminData.roleId, // Assuming roleId 1 is SUPER_ADMIN
//       profile: {
//         create: {
//           first_name: superAdminData.profile.firstName,
//           last_name: superAdminData.profile.lastName,
//           sex: superAdminData.profile.sex,
//           dob: new Date(superAdminData.profile.dob),
//           pob: superAdminData.profile.pob,
//           address: superAdminData.profile.address,
//           phone: superAdminData.profile.phone,
//           married: superAdminData.profile.married,
//           bio: superAdminData.profile.bio || '',
//           createdBy: 1,
//           lastUpdatedBy: 1,
//         },
//       },
//       refreshTokens: {
//         create: {
//           token: this.generateRefreshToken({
//             userId: 1,
//             username: superAdminData.username,
//             email: superAdminData.email,
//             role: 'SUPER_ADMIN',
//           }),
//           expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
//         },
//       },
//       createdBy: 1,
//       lastUpdatedBy: 1,
//       auditTrail: {
//         create: {
//           action: 'REGISTER_SUPER_ADMIN',
//           timestamp: new Date(),
//           ipAddress: 'LOCALHOST',
//           description: 'DEFAULT_ADMIN_SEEDED',
//         },
//       },
//     },
//     include: {
//       profile: true,
//       refreshTokens: true,
//     },
//   });

//   // If you need the actual userId for the token after creation and it's not 1
//   if (
//     superAdmin.id !== tokenPayload.userId &&
//     superAdmin.refreshTokens.length > 0
//   ) {
//     console.log(
//       `Admin user created/found with ID: ${adminUser.id}. Initial token was for placeholder ID.`,
//     );
//     // Optionally, you could update the token here if userId is crucial for its payload
//     // and different from a hardcoded one. For simplicity, this step is often skipped in basic seeds.
//   }

//   console.log('Admin user seeded successfully:', {
//     id: adminUser.id,
//     email: adminUser.email,
//     role: adminUser.role,
//     profile: adminUser.profile,
//     // Be careful logging tokens, even in seeds
//     // refreshTokenId: adminUser.refreshTokens.length > 0 ? adminUser.refreshTokens[0].id : null
//   });

//   console.log(`✅ Super admin created/verified: ${superAdmin.email}`);
//   return superAdmin;
// }

// function getRoleByName(data: RolesData, roleName: string): Role | undefined {
//   return data.roles.find(role => role.name === roleName);
// }

// private getSuperAdminRole(roles: Role[], roleName: string): Role {
//   const result = roles.find((role) => role.name === roleName);
//   const defaultRole =
//     roles.length > 0
//       ? roles[0]
//       : ({
//           id: 1,
//           name: 'SUPER_ADMIN',
//           description: 'Super Administrator Role',
//           enabledFlag: true,
//           createdBy: 0,
//           createdDate: new Date(),
//           lastUpdatedBy: 0,
//           lastUpdatedDate: new Date(),
//           objectVersionId: 1,
//         } as Role);
//   return result || defaultRole;
// }

// private async hashPassword(password: string): Promise<string> {
//   const saltRounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'));
//   return bcrypt.hash(password, saltRounds);
// }

// private generateRefreshToken(payload: TokenPayload): string {
//   const secret =
//     this.config.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret';
//   const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
//   return jwt.sign(payload, secret, { expiresIn });
// }
