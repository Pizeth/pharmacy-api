import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';
import { PrismaClient } from '@prisma/client';

// Import other seeders as needed

@Injectable()
export class SeedService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly userSeeder: UserSeeder,
    private readonly roleSeeder: RoleSeeder,
  ) {
    super({
      // Optional: Add Prisma Client options here, e.g., logging
      // log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Prisma Client connected for seeding.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma Client disconnected after seeding.');
  }

  //   async seedDatabase() {
  //     try {
  //       await this.createSuperAdmin();
  //       // Add other seed functions here
  //       console.log('Database seeding completed successfully');
  //     } catch (error) {
  //       console.error('Database seeding failed:', error);
  //       process.exit(1);
  //     } finally {
  //       await this.prisma.$disconnect();
  //     }
  //   }

  async seedAll() {
    // Check if we're in production and have safety checks
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (nodeEnv === 'production') {
      const allowProdSeeding = this.config.get<string>(
        'ALLOW_PRODUCTION_SEEDING',
      );
      if (!allowProdSeeding) {
        throw new Error(
          'Production seeding is disabled. Set ALLOW_PRODUCTION_SEEDING=true to override.',
        );
      }
    }

    // Run seeders in order (important for foreign key constraints)
    console.log('🔧 Seeding roles...');
    const roles = await this.roleSeeder.seed();

    console.log('👤 Seeding users...');
    await this.userSeeder.seed(roles);

    // Add more seeders here
    console.log('📊 Database Seeding completed');
  }

  async clearAll() {
    console.log('🧹 Clearing database...');

    // Clear in reverse order of dependencies
    await this.prisma.auditTrail.deleteMany();
    await this.prisma.refreshToken.deleteMany();
    await this.prisma.profile.deleteMany();
    await this.prisma.user.deleteMany();
    // Add other cleanup as needed

    console.log('✅ Database cleared');
  }
}
