import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma.module';
import { logger } from 'nestjs-i18n/dist/utils';
import { configurationSchema } from 'validation/configuration.schema';
import z, { ZodError } from 'zod';
import { ValidationError } from 'exceptions/zod-validatoin.exception';
// Seed Engine Framework Components
import { Seeder } from './seeder';
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';

@Module({
  imports: [
    PrismaModule, // Ensure PrismaModule is also imported
    ConfigModule.forRoot({
      isGlobal: true, // Recommended to avoid re-importing in sub-dependencies
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: (config: Record<string, any>) => {
        try {
          const validatedConfig = configurationSchema.parse(config);
          logger.log('✅ Configuration validation successful', 'SeederModule');
          return validatedConfig;
        } catch (error: unknown) {
          if (error instanceof ZodError) {
            // const errorMessages = error.errors.map((e) => {
            //   // e.message already contains the internationalized message from our helpers
            //   return `${e.path.join('.')}: ${e.message}`;
            // });
            // logger.error(
            //   '❌ Configuration validation error details:',
            //   JSON.stringify(error.flatten(), null, 2),
            // );
            // throw new Error(
            //   `Configuration validation failed:\n${errorMessages.join('\n')}`,
            // );
            if (error instanceof ZodError) {
              throw new ValidationError(error, z.treeifyError);
            }
          }
          // logger.error(
          //   '❌ Unexpected error during configuration validation:',
          //   error,
          // );
          logger.error(
            '❌ Unexpected fatal error encountered during configuration validation:',
            error,
            'SeederModule',
          );
          throw error; // Re-throw other unexpected errors
        }
      },
    }),
  ],
  providers: [RoleSeeder, UserSeeder, Seeder],
  exports: [Seeder],
})
export class SeederModule {}
