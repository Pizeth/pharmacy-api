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

// src/modules/prisma/seeders/seeder.ts

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../services/prisma.service';
import { RoleSeeder } from './role.seeder';
import { TranslationSeeder } from './translation.seeder';
import { UserSeeder } from './user.seeder';
import { PermissionSeeder } from './permission.seeder';

/**
 * Commands understood by the standalone Prisma seed runner.
 */
export type SeedCommand = 'seed' | 'permissions' | 'translations' | 'clear';

@Injectable()
export class Seeder implements OnModuleInit {
  private readonly logger = new Logger(Seeder.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UserSeeder) private readonly userSeeder: UserSeeder,
    @Inject(RoleSeeder) private readonly roleSeeder: RoleSeeder,
    @Inject(TranslationSeeder)
    private readonly translationSeeder: TranslationSeeder,
    @Inject(PermissionSeeder)
    private readonly permissionSeeder: PermissionSeeder,
  ) {
    // Add some debugging to see what's being injected
    this.logger.debug(`${this.constructor.name} initialized`);
  }

  /**
   * Diagnostic only.
   *
   * This is useful for the standalone CLI application context because
   * seed initialization failures are otherwise harder to diagnose.
   */
  onModuleInit(): void {
    this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
    this.logger.debug(`ConfigService injected: ${!!this.config}`);
    this.logger.debug(`UserSeeder injected: ${!!this.userSeeder}`);
    this.logger.debug(`RoleSeeder injected: ${!!this.roleSeeder}`);
    this.logger.debug(
      `TranslationSeeder injected: ${!!this.translationSeeder}`,
    );
  }

  /**
   * CLI command dispatcher.
   */
  async run(command: SeedCommand): Promise<void> {
    this.logger.log(`Running database command: ${command}`);

    if (!this.prisma) {
      throw new Error(
        'PrismaService is not available. Check SeederModule dependency injection.',
      );
    }

    /**
     * Protect every command capable of mutating database state.
     * including clear.
     */
    this.assertDatabaseMutationAllowed();

    switch (command) {
      case 'seed':
        await this.seedAll();
        return;

      case 'translations':
        await this.seedTranslations();
        return;

      case 'permissions':
        await this.seedPermissions();
        return;

      case 'clear':
        await this.clearAll();
        return;
    }
  }

  /**
   * ----------------------------------------------------------------
   * Production protection to prevent accidental mutation of
   * the production database.
   * ----------------------------------------------------------------
   */
  private assertDatabaseMutationAllowed(): void {
    const nodeEnv = this.config
      .get<string>('NODE_ENV', 'development')
      .toLowerCase();

    const allowProductionSeeding =
      this.config.get<boolean>('ALLOW_PRODUCTION_SEEDING', false) === true;

    this.logger.log(`NODE_ENV=${nodeEnv}`);

    if (nodeEnv === 'production' && !allowProductionSeeding) {
      throw new Error(
        'Production database seeding/clearing is disabled. Set ALLOW_PRODUCTION_SEEDING=true to override.',
      );
    }
  }

  /**
   * ----------------------------------------------------------------
   * Seed the complete application's baseline data.
   * ----------------------------------------------------------------
   */
  private async seedAll() {
    this.logger.log('🌱 Beginning complete database seeding process...');

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        /**
         * ------------------------------------------------------
         * 1. Authorization baseline
         * ------------------------------------------------------
         *
         * Foreign-key order:
         *
         * Role
         *   ↓
         * User
         *
         * Translation models are independent from User/Role but
         * remain inside the same initialization transaction.
         */
        this.logger.log('🔧 Seeding roles...');

        const roles = await this.roleSeeder.seed(tx);

        /**
         * 2. Role Permission
         */

        this.logger.log('🔐 Seeding authorization permissions...');

        const permissions = await this.permissionSeeder.seed(roles, tx);

        /**
         * ------------------------------------------------------
         * 2. Administrative baseline
         * ------------------------------------------------------
         */
        this.logger.log('👤 Seeding users...');

        const user = await this.userSeeder.seed(roles, tx);

        /**
         * ------------------------------------------------------
         * 3. Translation baseline
         * ------------------------------------------------------
         */
        this.logger.log('🌐 Seeding translations...');

        const translations = await this.translationSeeder.seed(tx);

        return { roles, permissions, user, translations };
      },

      /**
       * Translation seeding adds a meaningful number of upserts.
       *
       * A 60-second timeout is reasonable for a CLI initialization
       * process, especially with remote PostgreSQL/Supabase database.
       */
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    this.logger.log(
      `✅ Complete database seed finished 📊: ${result.roles.length} roles, super-admin verified, ${result.translations.keys} translation keys.`,
    );
    return result;
  }

  private async seedPermissions(): Promise<void> {
    this.logger.log('🔐 Beginning authorization-only seed...');

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        /**
         * Ensure baseline roles exist first.
         */
        const roles = await this.roleSeeder.seed(tx);

        return this.permissionSeeder.seed(roles, tx);
      },

      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    this.logger.log(
      `✅ Authorization-only seed finished: ${result.permissions} permissions, ${result.assignments} assignments.`,
    );
  }

  /**
   * ----------------------------------------------------------------
   * Translation-only seed
   * ----------------------------------------------------------------
   * This command is intentionally independent from RoleSeeder and
   * UserSeeder.
   *
   * It is ideal for the current database, where roles/users already
   * exist but translation tables are still empty.
   */
  private async seedTranslations(): Promise<void> {
    this.logger.log('🌐 Beginning translation-only seed...');

    const result = await this.prisma.$transaction(
      (tx: Prisma.TransactionClient) => this.translationSeeder.seed(tx),
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    this.logger.log(
      `✅ Translation-only seed finished: ${result.categories} categories, ${result.keys} keys, ${result.translations} locale values.`,
    );
  }

  /**
   * ----------------------------------------------------------------
   * Clear application seedable data
   * ----------------------------------------------------------------
   */
  private async clearAll(): Promise<void> {
    this.logger.warn('🧹 Clearing database seedable data...');

    await this.prisma.$transaction([
      /**
       * ----------------------------------------------------------
       * Translation hierarchy
       * ----------------------------------------------------------
       *
       * Translation
       *     ↓
       * TranslationKey
       *     ↓
       * TranslationCategory
       */
      this.prisma.translation.deleteMany(),

      this.prisma.translationKey.deleteMany(),

      this.prisma.translationCategory.deleteMany(),

      /**
       * Existing identity/domain cleanup.
       */
      this.prisma.auditTrail.deleteMany(),

      this.prisma.profile.deleteMany(),

      this.prisma.account.deleteMany(),

      this.prisma.user.deleteMany(),

      this.prisma.rolePermission.deleteMany(),

      this.prisma.permission.deleteMany(),

      this.prisma.role.deleteMany(),
    ]);

    this.logger.log('✅ Database clear completed.');
  }
}
