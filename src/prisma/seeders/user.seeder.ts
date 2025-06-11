import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import type { SuperAdminData } from 'src/types/seed';
import { RefreshToken, Role } from '@prisma/client';
import { TokenService } from 'src/services/access-token.service';
import { PasswordUtils } from 'src/utils/password-utils.service';
import { RoleToken } from 'src/types/token';
import { Sex } from 'src/types/commons.enum';

@Injectable()
export class UserSeeder {
  private readonly logger = new Logger(UserSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => TokenService))
    private readonly token: TokenService,
    @Inject(forwardRef(() => PasswordUtils))
    private readonly passwordUtils: PasswordUtils,
  ) {}

  async seed(roles: Role[]) {
    this.logger.log('🌱 Seeding super admin user...');
    const superAdminData = this.getSuperAdminData(roles);
    try {
      // Wrap the operations in an atomic transaction.
      const result = await this.prisma.$transaction(async (tx) => {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days.
        // Step 1: Upsert the super admin.
        const superAdmin = await tx.user.upsert({
          where: { email: superAdminData.email },
          update: {
            // Update fields as needed if the user already exists.
            roleId: superAdminData.roleId,
            lastUpdatedBy: 0, // Placeholder (will be replaced).
          },
          create: {
            username: superAdminData.username,
            email: superAdminData.email,
            password: await this.passwordUtils.hash(superAdminData.password),
            avatar: superAdminData.avatar,
            roleId: superAdminData.roleId,
            // Using nested writes for related data.
            profile: {
              create: {
                first_name: superAdminData.profile.firstName,
                last_name: superAdminData.profile.lastName,
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
            refreshTokens: {
              create: {
                token: this.token.generateToken({
                  id: 0, // Placeholder.
                  username: superAdminData.username,
                  email: superAdminData.email,
                  roleId: superAdminData.roleId,
                  role: this.getRoleToken(superAdminData.role),
                  ip: 'LOCALHOST',
                }),
                expiresAt: expiresAt,
              },
            },
            createdBy: 0, // Placeholder.
            lastUpdatedBy: 0, // Placeholder.
            auditTrail: {
              create: {
                action: 'REGISTER_SUPER_ADMIN',
                timestamp: new Date(),
                ipAddress: 'LOCALHOST',
                description: 'DEFAULT_ADMIN_SEEDED',
              },
            },
          },
          include: {
            profile: true,
            role: true,
            refreshTokens: true,
          },
        });

        // Step 2: Update the just created user with its own id for audit fields.
        const userId = superAdmin.id;

        const updatedRoles = await tx.role.updateManyAndReturn({
          where: { createdBy: 0, lastUpdatedBy: 0 }, //Roles that was created using Placeholder
          data: { createdBy: userId, lastUpdatedBy: userId },
        });

        const updatedSuperAdmin = await tx.user.update({
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
            // (Optionally) update refreshTokens if they need to reference the user's id.
            refreshTokens: {
              update: {
                where: {
                  id: this.getSeedToken(
                    superAdmin.refreshTokens,
                    userId,
                    expiresAt,
                  ),
                },
                data: {
                  token: this.token.generateToken({
                    id: userId,
                    username: superAdmin.username,
                    email: superAdmin.email,
                    roleId: superAdmin.roleId,
                    role: this.getRoleToken(superAdmin.role),
                    ip: 'LOCALHOST',
                  }),
                },
              },
            },
          },
          include: {
            profile: true,
            role: true,
            refreshTokens: true,
          },
        });

        // If you need the actual userId for the token after creation and it's not 1
        if (
          updatedRoles.every(
            (role) =>
              role.createdBy !== userId || role.lastUpdatedBy !== userId,
          ) ||
          (updatedSuperAdmin.refreshTokens.length > 0 &&
            updatedSuperAdmin.refreshTokens.find(
              (token) => token.userId !== userId,
            ))
        ) {
          this.logger.log(
            `Admin user created/found with ID: ${userId}. Initial token was for placeholder ID.`,
          );
          // Optionally, you could update the token here if userId is crucial for its payload
          // and different from a hardcoded one. For simplicity, this step is often skipped in basic seeds.
        }

        return updatedSuperAdmin;
      });

      this.logger.log('🌱 Super Admin user seeded successfully:', {
        id: result.id,
        email: result.email,
        role: result.roleId,
        profile: result.profile,
        // Be careful logging tokens, even in seeds
        // refreshTokenId: adminUser.refreshTokens.length > 0 ? adminUser.refreshTokens[0].id : null
      });
      const adminRole = roles.find((role) => role.name === 'SUPER_ADMIN');
      if (!adminRole) {
        throw new Error('SUPER_ADMIN role not found after seeding roles.');
      }

      this.logger.log(`✅ Super admin created/verified: ${result.email}`);
      return result;
    } catch (error: unknown) {
      this.logger.log(
        `Failed to seed Super Admin ${roles.map((r) => r.name).join(', ')}:`,
        error,
      );
    }
  }

  private getRoleToken(role: Role): RoleToken {
    if (!role) {
      return {
        id: 0,
        name: 'SUPER_ADMIN',
        descrition: 'Super Administrator with full access',
      };
    }
    return {
      id: role.id,
      name: role.name,
      descrition: role.description,
    };
  }

  private getSeedToken(
    refreshTokens: RefreshToken[],
    id: number,
    expiresAt: Date,
  ): number | undefined {
    return refreshTokens.find(
      (token) =>
        token.userId === id &&
        token.expiresAt.getTime() === expiresAt.getTime(),
    )?.id;
  }

  private getSuperAdminRole(roles: Role[], roleName: string): Role {
    return (
      roles.find((role) => role.name === roleName) ||
      (roles.length > 0
        ? roles[0]
        : ({
            id: 1,
            name: 'SUPER_ADMIN',
            description: 'Super Administrator Role',
            enabledFlag: true,
            createdBy: 0,
            createdDate: new Date(),
            lastUpdatedBy: 0,
            lastUpdatedDate: new Date(),
            objectVersionId: 1,
          } as Role))
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
