// import { Injectable, Logger } from '@nestjs/common';
// import { ModuleRef } from '@nestjs/core';
// import { PrismaService } from '../prisma.service';
// import { RoleSeeder } from './role.seeder';
// import { UserSeeder } from './user.seeder';

// @Injectable()
// export class Seeder {
//   private readonly logger = new Logger(Seeder.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly moduleRef: ModuleRef, // We inject ModuleRef to resolve dependencies manually
//   ) {
//     // Add some debugging to see what's being injected
//     this.logger.debug('Seeder constructor called');
//     this.logger.debug('PrismaService injected:', !!this.prisma);
//     this.logger.debug('ModuleRef injected:', !!this.moduleRef);
//   }

//   async run(command: 'seed' | 'clear') {
//     this.logger.debug(`Running command: ${command}`);
//     this.logger.debug('PrismaService available:', !!this.prisma);

//     if (!this.prisma) {
//       throw new Error(
//         'PrismaService is not available. Check dependency injection.',
//       );
//     }

//     if (command === 'seed') {
//       await this.seedAll();
//     } else if (command === 'clear') {
//       await this.clearAll();
//     }
//   }

//   private async seedAll() {
//     this.logger.log('Beginning seeding process...');

//     // Resolve the individual seeders from the DI container at RUNTIME.
//     // This is the most robust way to avoid circular dependency issues.
//     const roleSeeder = this.moduleRef.get(RoleSeeder, { strict: false });
//     const userSeeder = this.moduleRef.get(UserSeeder, { strict: false });

//     this.logger.log('🔧 Seeding roles...');
//     const roles = await roleSeeder.seed();

//     this.logger.log('👤 Seeding users...');
//     await userSeeder.seed(roles);

//     this.logger.log('📊 Database Seeding completed');
//   }

//   private async clearAll() {
//     this.logger.log('🧹 Clearing database...');
//     // `this.prisma` will be correctly injected because its dependency chain is simple.
//     await this.prisma.$transaction([
//       // Clear in reverse order of dependencies
//       this.prisma.refreshToken.deleteMany(),
//       this.prisma.profile.deleteMany(),
//       this.prisma.user.deleteMany(),
//       this.prisma.role.deleteMany(),
//       // Add other cleanup as needed
//     ]);
//     this.logger.log('✅ Database cleared');
//   }
// }

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RoleSeeder } from './role.seeder';
import { UserSeeder } from './user.seeder';

@Injectable()
export class Seeder {
  private readonly logger = new Logger(Seeder.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly roleSeeder: RoleSeeder,
    private readonly userSeeder: UserSeeder,
  ) {
    this.logger.debug('Seeder constructor called');
    this.logger.debug('PrismaService injected:', !!this.prisma);
    this.logger.debug('RoleSeeder injected:', !!this.roleSeeder);
    this.logger.debug('UserSeeder injected:', !!this.userSeeder);
  }

  async run(command: 'seed' | 'clear') {
    this.logger.debug(`Running command: ${command}`);

    if (!this.prisma) {
      throw new Error(
        'PrismaService is not available. Check dependency injection.',
      );
    }

    if (command === 'seed') {
      await this.seedAll();
    } else if (command === 'clear') {
      await this.clearAll();
    }
  }

  private async seedAll() {
    this.logger.log('Beginning seeding process...');

    this.logger.log('🔧 Seeding roles...');
    const roles = await this.roleSeeder.seed();

    this.logger.log('👤 Seeding users...');
    await this.userSeeder.seed(roles);

    this.logger.log('📊 Database Seeding completed');
  }

  private async clearAll() {
    this.logger.log('🧹 Clearing database...');

    await this.prisma.$transaction([
      // Clear in reverse order of dependencies
      this.prisma.refreshToken.deleteMany(),
      this.prisma.profile.deleteMany(),
      this.prisma.user.deleteMany(),
      this.prisma.role.deleteMany(),
      // Add other cleanup as needed
    ]);
    this.logger.log('✅ Database cleared');
  }
}
