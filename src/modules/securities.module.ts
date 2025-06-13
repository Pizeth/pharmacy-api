import { Global, Logger, Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from 'src/services/token.service';
import { PasswordUtils } from 'src/utils/password-utils.service';
import { configurationSchema } from 'src/validation/configuration.schema';
import { ZodError } from 'zod';
import { PrismaService } from 'src/prisma/prisma.service';

const logger = new Logger('Security Module');

// @Global()
@Module({
  imports: [
    // PrismaModule,
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
  // Provide all necessary services for the seeder context
  providers: [TokenService, PasswordUtils],
  exports: [
    TokenService,
    PasswordUtils,
    // PrismaService,
    ConfigModule,
    JwtModule,
  ],
})
export class SecurityModule {}
