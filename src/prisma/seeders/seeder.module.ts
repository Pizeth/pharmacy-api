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
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';
import { SecurityModule } from 'src/modules/securities.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [
    SecurityModule, // This brings in all the dependencies
    // PrismaModule, // Ensure PrismaModule is also imported
  ],
  providers: [Seeder, UserSeeder, RoleSeeder],
  exports: [Seeder],
})
export class SeederModule {}
