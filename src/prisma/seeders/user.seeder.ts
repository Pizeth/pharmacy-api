import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Sex, SuperAdminData } from 'src/types/seed';

interface TokenPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
}

@Injectable()
export class UserSeeder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async seed() {
    const superAdminData = this.getSuperAdminData();

    const superAdmin = await this.prisma.user.upsert({
      where: { email: superAdminData.email },
      update: {}, // Don't update if exists
      create: {
        username: superAdminData.username,
        email: superAdminData.email,
        password: await this.hashPassword(superAdminData.password),
        avatar: superAdminData.avatar,
        roleId: superAdminData.roleId || 1, // Assuming roleId 1 is SUPER_ADMIN
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
            createdBy: 1,
            lastUpdatedBy: 1,
          },
        },
        refreshTokens: {
          create: {
            token: this.generateRefreshToken({
              userId: 1,
              username: superAdminData.username,
              email: superAdminData.email,
              role: 'SUPER_ADMIN',
            }),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        },
        createdBy: 1,
        lastUpdatedBy: 1,
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
        refreshTokens: true,
      },
    });

    console.log(`✅ Super admin created/verified: ${superAdmin.email}`);
    return superAdmin;
  }

  private getSuperAdminData(): SuperAdminData {
    return {
      username: this.config.get('SEED_ADMIN_USERNAME', 'razeth'),
      email: this.config.get('SEED_ADMIN_EMAIL', 'seth.razeth@gmail.com'),
      password: this.config.get('SEED_ADMIN_PASSWORD', 'Kokakola1!'),
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

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'));
    return bcrypt.hash(password, saltRounds);
  }

  private generateRefreshToken(payload: TokenPayload): string {
    const secret =
      this.config.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret';
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    return jwt.sign(payload, secret, { expiresIn });
  }
}
