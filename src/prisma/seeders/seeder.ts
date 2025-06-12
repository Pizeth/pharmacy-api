// import { Injectable, Logger } from '@nestjs/common';
// // import { ModuleRef } from '@nestjs/core';
// import { PrismaService } from '../prisma.service';
// import { RoleSeeder } from './role.seeder';
// import { UserSeeder } from './user.seeder';
// import { ConfigService } from '@nestjs/config';
// // import { TokenService } from 'src/services/access-token.service';
// // import { PasswordUtils } from 'src/utils/password-utils.service';

// @Injectable()
// export class Seeder {
//   private readonly logger = new Logger(Seeder.name);

//   // These will be instantiated in the run() method.
//   // private prisma!: PrismaService;
//   // private moduleRef: ModuleRef;
//   // private config!: ConfigService;
//   // private tokenService!: TokenService;
//   // private passwordUtils!: PasswordUtils;

//   // constructor(
//   //   private readonly prisma: PrismaService,
//   //   // private readonly moduleRef: ModuleRef, // We inject ModuleRef to resolve dependencies manually
//   //   private readonly config: ConfigService,
//   //   // private readonly tokenService: TokenService,
//   //   // private readonly passwordUtils: PasswordUtils,
//   //   private readonly userSeeder: UserSeeder,
//   //   private readonly roleSeeder: RoleSeeder,
//   // ) {
//   //   // Add some debugging to see what's being injected
//   //   this.logger.debug('Seeder constructor called');
//   //   this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
//   //   // this.logger.debug(`ModuleRef injected:: ${!!this.moduleRef}`);
//   // }

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly roleSeeder: RoleSeeder,
//     private readonly userSeeder: UserSeeder,
//   ) {}

//   // constructor(moduleRef: ModuleRef, ) {
//   //   this.moduleRef = moduleRef;
//   //   this.logger.debug('Seeder constructor called');
//   //   this.logger.debug(`ModuleRef injected:: ${!!this.moduleRef}`);
//   // }

//   initialize() {
//     // this.prisma = await this.moduleRef.get(PrismaService, { strict: false });
//     // this.config = await this.moduleRef.get(ConfigService, { strict: false });
//     // this.tokenService = await this.moduleRef.get(TokenService, {
//     //   strict: false,
//     // });
//     // this.passwordUtils = await this.moduleRef.get(PasswordUtils, {
//     //   strict: false,
//     // });
//     this.logger.debug(`PrismaService resolved: ${!!this.prisma}`);
//     // this.logger.debug(`ConfigService resolved: ${!!this.config}`);
//     // this.logger.debug(`TokenService resolved: ${!!this.tokenService}`);
//     // this.logger.debug(`PasswordUtils resolved: ${!!this.passwordUtils}`);

//     if (!this.prisma) {
//       throw new Error('PrismaService is not available');
//     }
//   }

//   async run(command: 'seed' | 'clear') {
//     this.logger.debug(`Running command: ${command}`);
//     this.logger.debug(`PrismaService available: ${!!this.prisma}`);
//     this.logger.debug(
//       `PrismaService client: ${this.prisma ? 'exists' : 'missing'}`,
//     );
//     // await this.initialize();

//     // Manually instantiate the seeder classes, passing in the injected dependencies.
//     // This happens at runtime, completely avoiding DI issues for these classes.
//     // this.roleSeeder = new RoleSeeder(this.prisma);
//     // this.userSeeder = new UserSeeder(
//     //   this.prisma,
//     //   this.config,
//     //   this.tokenService,
//     //   this.passwordUtils,
//     // );

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
//     this.logger.debug('Beginning seeding process...');

//     // Resolve the individual seeders from the DI container at RUNTIME.
//     // This is the most robust way to avoid circular dependency issues.
//     // const roleSeeder = this.moduleRef.get(RoleSeeder, { strict: false });
//     // const userSeeder = this.moduleRef.get(UserSeeder, { strict: false });
//     // Manually instantiate seeders with dependencies
//     // const roleSeeder = new RoleSeeder(this.prisma);
//     // const userSeeder = new UserSeeder(
//     //   this.prisma,
//     //   this.config,
//     //   this.tokenService,
//     //   this.passwordUtils,
//     // );

//     this.logger.debug(this.roleSeeder);
//     this.logger.debug(this.userSeeder);

//     this.logger.log('🔧 Seeding roles...');
//     const roles = await this.roleSeeder.seed();

//     this.logger.log('👤 Seeding users...');
//     await this.userSeeder.seed(roles);

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

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RoleSeeder } from './role.seeder';
import { UserSeeder } from './user.seeder';

@Injectable()
export class Seeder {
  private readonly logger = new Logger(Seeder.name);

  // With a clean DI graph, we can go back to simple constructor injection.
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleSeeder: RoleSeeder,
    private readonly userSeeder: UserSeeder,
  ) {}

  async run(command: 'seed' | 'clear') {
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
    // `this.prisma` will be correctly injected.
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany(),
      this.prisma.profile.deleteMany(),
      this.prisma.user.deleteMany(),
      this.prisma.role.deleteMany(),
    ]);
    this.logger.log('✅ Database cleared');
  }
}

// import { Inject, Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../prisma.service';
// import { RoleSeeder } from './role.seeder';
// import { UserSeeder } from './user.seeder';

// @Injectable()
// export class Seeder {
//   private readonly logger = new Logger(Seeder.name);

//   constructor(
//     @Inject(PrismaService) private readonly prisma: PrismaService,
//     private readonly roleSeeder: RoleSeeder,
//     private readonly userSeeder: UserSeeder,
//   ) {
//     this.logger.debug('Seeder constructor called');
//     this.logger.debug('PrismaService injected:', !!this.prisma);
//     this.logger.debug('RoleSeeder injected:', !!this.roleSeeder);
//     this.logger.debug('UserSeeder injected:', !!this.userSeeder);
//   }

//   async run(command: 'seed' | 'clear') {
//     this.logger.debug(`Running command: ${command}`);

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

//     this.logger.log('🔧 Seeding roles...');
//     const roles = await this.roleSeeder.seed();

//     this.logger.log('👤 Seeding users...');
//     await this.userSeeder.seed(roles);

//     this.logger.log('📊 Database Seeding completed');
//   }

//   private async clearAll() {
//     this.logger.log('🧹 Clearing database...');

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
