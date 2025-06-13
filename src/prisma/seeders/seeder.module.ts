// import { Module } from '@nestjs/common';
// import { PrismaModule } from '../prisma.module';
// // import { SeedService } from './seed.service';
// // import { UserSeeder } from './user.seeder';
// // import { RoleSeeder } from './role.seeder';
// import { ConfigModule } from '@nestjs/config';
// // import { JwtModule } from '@nestjs/jwt';
// // import { TokenService } from 'src/services/access-token.service';
// // import { PasswordUtils } from 'src/utils/password-utils.service';
// // import { configurationSchema } from 'src/validation/configuration.schema';
// // import { ZodError } from 'zod';
// import { Seeder } from './seeder';
// import { ModuleRef } from '@nestjs/core';
// import { SecurityModule } from 'src/modules/securities.module';

// // const logger = new Logger('Seed Module');
// @Module({
//   imports: [
//     PrismaModule,
//     SecurityModule,
//     ConfigModule.forRoot({
//       isGlobal: true, // Recommended to avoid re-importing in sub-dependencies
//       envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
//       // validate: (config: Record<string, any>) => {
//       //   // l.log(config);
//       //   try {
//       //     const validatedConfig = configurationSchema.parse(config);
//       //     logger.log('✅ Configuration validation successful');
//       //     return validatedConfig;
//       //   } catch (error: unknown) {
//       //     if (error instanceof ZodError) {
//       //       const errorMessages = error.errors.map((e) => {
//       //         // e.message already contains the internationalized message from our helpers
//       //         return `${e.path.join('.')}: ${e.message}`;
//       //       });
//       //       // const errorMessages = error.errors.map(
//       //       //   (e) => `${e.path.join('.')}: ${e.message}`,
//       //       // );
//       //       logger.error(
//       //         '❌ Configuration validation error details:',
//       //         JSON.stringify(error.flatten(), null, 2),
//       //       );
//       //       throw new Error(
//       //         `Configuration validation failed:\n${errorMessages.join('\n')}`,
//       //       );
//       //     }
//       //     logger.error(
//       //       '❌ Unexpected error during configuration validation:',
//       //       error,
//       //     );
//       //     throw error; // Re-throw other unexpected errors
//       //   }
//       // },
//     }),
//     // JwtModule.registerAsync({
//     //   imports: [ConfigModule],
//     //   inject: [ConfigService],
//     //   useFactory: (config: ConfigService) => ({
//     //     secret: config.get('SECRET_KEY'), // Or a default for seeding
//     //     signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
//     //   }),
//     // }),
//   ],
//   // Provide all necessary services for the seeder context
//   providers: [
//     // {
//     //   provide: Seeder,
//     //   useFactory: (moduleRef: ModuleRef) => new Seeder(moduleRef),
//     //   inject: [ModuleRef],
//     // },
//     Seeder,
//     // UserSeeder,
//     // RoleSeeder,
//     // TokenService,
//     // PasswordUtils,
//   ],
//   exports: [Seeder],
// })
// export class SeederModule {}

import { Module } from '@nestjs/common';
import { Seeder } from './seeder';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TokenService } from 'src/services/token.service';
import { PasswordUtils } from 'src/utils/password-utils.service';
import { PrismaService } from '../prisma.service';
import { PrismaModule } from '../prisma.module';
import { logger } from 'nestjs-i18n';
import { configurationSchema } from 'src/validation/configuration.schema';
import { ZodError } from 'zod';

@Module({
  imports: [
    PrismaModule, // Ensure PrismaModule is also imported
    ConfigModule.forRoot({
      isGlobal: true, // Recommended to avoid re-importing in sub-dependencies
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: (config: Record<string, any>) => {
        try {
          const validatedConfig = configurationSchema.parse(config);
          logger.log('✅ Configuration validation successful');
          return validatedConfig;
        } catch (error: unknown) {
          if (error instanceof ZodError) {
            const errorMessages = error.errors.map((e) => {
              // e.message already contains the internationalized message from our helpers
              return `${e.path.join('.')}: ${e.message}`;
            });
            logger.error(
              '❌ Configuration validation error details:',
              JSON.stringify(error.flatten(), null, 2),
            );
            throw new Error(
              `Configuration validation failed:\n${errorMessages.join('\n')}`,
            );
          }
          logger.error(
            '❌ Unexpected error during configuration validation:',
            error,
          );
          throw error; // Re-throw other unexpected errors
        }
      },
    }),
    // Configure JwtModule here as well, since TokenService depends on it.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_KEY'), // Or a default for seeding
        signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
      }),
    }),
  ],
  providers: [
    // We define a custom factory for our main Seeder class.
    {
      provide: TokenService,
      useFactory: (
        // The factory function receives the fully resolved dependencies as arguments.
        prisma: PrismaService,
        config: ConfigService,
        jwt: JwtService,
      ) => {
        // 1. Manually create the main TokenService instance, passing in the helper instances.
        return new TokenService(config, prisma, jwt);
      },
      // 2. List all the dependencies that the factory needs. NestJS will resolve these first.
      inject: [PrismaService, ConfigService, JwtService],
    },
    {
      provide: PasswordUtils,
      useFactory: (
        // The factory function receives the fully resolved dependencies as arguments.
        config: ConfigService,
      ) => {
        // 1. Manually create the main PasswordUtils instance, passing in the helper instances.
        return new PasswordUtils(config);
      },
      // 2. List all the dependencies that the factory needs. NestJS will resolve these first.
      inject: [ConfigService],
    },
    {
      provide: Seeder,
      useFactory: (
        // The factory function receives the fully resolved dependencies as arguments.
        prisma: PrismaService,
        config: ConfigService,
        tokenService: TokenService,
        passwordUtils: PasswordUtils,
      ) => {
        // 1. Manually create the main Seeder instance, passing in the helper instances.
        return new Seeder(prisma, config, tokenService, passwordUtils);
      },
      // 2. List all the dependencies that the factory needs. NestJS will resolve these first.
      inject: [PrismaService, ConfigService, TokenService, PasswordUtils],
    },
  ],
})
export class SeederModule {}
