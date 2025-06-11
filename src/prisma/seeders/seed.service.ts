import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';
// import { ModuleRef } from '@nestjs/core';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // **CRITICAL FIX**: Use forwardRef for custom services injected here.
    // This breaks the DI resolution cycle.
    @Inject(forwardRef(() => UserSeeder))
    private readonly userSeeder: UserSeeder,
    @Inject(forwardRef(() => RoleSeeder))
    private readonly roleSeeder: RoleSeeder,
    // private readonly moduleRef: ModuleRef,
  ) {
    this.logger.debug('SeedService initialized');
    this.logger.debug('Prisma Service', prisma);
    // this.logger.debug('Prisma ModuleRef', moduleRef);
  }

  async seedAll() {
    // Access configuration safely with fallbacks
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const allowProdSeeding =
      this.config
        .get<string>('ALLOW_PRODUCTION_SEEDING', 'false')
        .toLowerCase() === 'true';
    // Check if we're in production and have safety checks;
    if (nodeEnv === 'production' && !allowProdSeeding) {
      throw new Error(
        'Production seeding is disabled. Set ALLOW_PRODUCTION_SEEDING=true to override.',
      );
    }

    // Run seeders in order (important for foreign key constraints)
    this.logger.log('🔧 Seeding roles...');
    const roles = await this.roleSeeder.seed();

    this.logger.log('👤 Seeding users...');
    await this.userSeeder.seed(roles);

    // Add more seeders here
    this.logger.log('📊 Database Seeding completed');
  }

  // async seedAll() {
  //   this.logger.log('Beginning seeding process...');

  //   // Resolve the individual seeders from the DI container at RUNTIME.
  //   // This breaks the constructor injection cycle and forces resolution.
  //   const roleSeeder = await this.moduleRef.resolve(RoleSeeder);
  //   const userSeeder = await this.moduleRef.resolve(UserSeeder);

  //   // Run seeders in order (important for foreign key constraints)
  //   this.logger.log('🔧 Seeding roles...');
  //   const roles = await roleSeeder.seed();

  //   this.logger.log('👤 Seeding users...');
  //   await userSeeder.seed(roles);

  //   this.logger.log('📊 Database Seeding completed');
  // }

  async clearAll() {
    this.logger.log('🧹 Clearing database...');
    this.logger.debug(this.prisma);

    // Use transactions for safety
    await this.prisma.$transaction([
      // Clear in reverse order of dependencies
      this.prisma.auditTrail.deleteMany(),
      this.prisma.refreshToken.deleteMany(),
      this.prisma.profile.deleteMany(),
      this.prisma.user.deleteMany(),
      // Add other cleanup as needed
    ]);

    this.logger.log('✅ Database cleared');
  }
}

// private getRequiredConfig(key: string): string {
//   // Null-safe access
//   if (!this.config) {
//     throw new Error('ConfigService is not available');
//   }

//   const value = this.config.get<string>(key);
//   if (!value) {
//     this.logger.error(`Missing configuration: ${key}`, SeedService.name);
//     throw new Error(`Required configuration '${key}' is missing`);
//   }
//   return value;
// }

// // Getter methods for lazy loading configuration
// private get nodeEnv(): string {
//   return this.getRequiredConfig('NODE_ENV') || 'development';
// }

// private get allowProdSeeding(): boolean {
//   return (
//     this.getRequiredConfig('ALLOW_PRODUCTION_SEEDING').toLowerCase() ===
//     'true'
//   );
// }

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
