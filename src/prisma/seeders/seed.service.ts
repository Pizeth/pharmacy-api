import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';

// Import other seeders as needed

@Injectable()
// extends PrismaClient
// implements OnModuleInit, OnModuleDestroy
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly userSeeder: UserSeeder,
    private readonly roleSeeder: RoleSeeder,
  ) {
    this.logger.debug('SeedService initialized');
    // super({
    //   // Optional: Add Prisma Client options here, e.g., logging
    //   // log: ['query', 'info', 'warn', 'error'],
    // });
  }

  // async onModuleInit() {
  //   await this.$connect();
  //   console.log('Prisma Client connected for seeding.');
  // }

  // async onModuleDestroy() {
  //   await this.$disconnect();
  //   console.log('Prisma Client disconnected after seeding.');
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

  private getRequiredConfig(key: string): string {
    // Null-safe access
    if (!this.config) {
      throw new Error('ConfigService is not available');
    }

    const value = this.config.get<string>(key);
    if (!value) {
      Logger.error(`Missing configuration: ${key}`, SeedService.name);
      throw new Error(`Required configuration '${key}' is missing`);
    }
    return value;
  }

  // Getter methods for lazy loading configuration
  private get nodeEnv(): string {
    return this.getRequiredConfig('NODE_ENV') || 'development';
  }

  private get allowProdSeeding(): boolean {
    return (
      this.getRequiredConfig('ALLOW_PRODUCTION_SEEDING').toLowerCase() ===
      'true'
    );
  }

  async seedAll() {
    // Check if we're in production and have safety checks;
    if (this.nodeEnv === 'production' && !this.allowProdSeeding) {
      throw new Error(
        'Production seeding is disabled. Set ALLOW_PRODUCTION_SEEDING=true to override.',
      );
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
