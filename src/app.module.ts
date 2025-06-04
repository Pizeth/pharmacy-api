import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service'; // Adjust path as needed
import { UsersService } from './user.service';
import { DBHelper } from './utils/db-helper';
import { VirusScanService } from './services/virus-scan.service';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { z, ZodError } from 'zod'; // Import Zod
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
  CookieResolver,
  GrpcMetadataResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { ConfigValidationMessages } from './types/i18n';

// R2_ACCOUNT_ID = '7fcff037e679e423265022c5b9f6be1c';
// R2_ACCESS_KEY_ID = 'c9db1a71be7599cbc13eff8c2bf1a575';
// R2_SECRET_ACCESS_KEY =
//   '000608fea622e90f6d2a733bf7fa7ba094d321df7ec2f661ca8ddaab3122548c';
// R2_BUCKET_NAME = 'piseth-chesda';
// R2_PUBLIC_DOMAIN = 'https://pub-ce3376330760464f8be1e4a3b46318c0.r2.dev';
// R2_EXPIRE_IN_SECONDS = '3600';
// R2_PUBLIC_URL = '';

const defaultMessages: ConfigValidationMessages = {
  requiredAndNotEmpty: '{field} is required and cannot be empty',
  invalidEmail: '{field} must be a valid email address',
  invalidUrl: '{field} must be a valid URL',
  minLength: '{field} must be at least {min} characters long',
  maxLength: '{field} must not exceed {max} characters',
  numericRequired: '{field} must be a valid number',
};
// Define the Zod schema for your configuration
const configSchema = z.object({
  R2_ACCESS_KEY: z
    .string()
    .min(1, { message: 'R2_ACCESS_KEY is required and cannot be empty' }),
  R2_SECRET_KEY: z
    .string()
    .min(1, { message: 'R2_SECRET_KEY is required and cannot be empty' }),
  R2_BUCKET_NAME: z
    .string()
    .min(1, { message: 'R2_BUCKET_NAME is required and cannot be empty' }),
  // Add other required environment variables here
  // Example of an optional variable with a default value:
  // OPTIONAL_VAR: z.string().optional().default('defaultValue'),
  // Example of a numeric variable:
  // PORT: z.coerce.number().int().positive().default(3000), // coerce converts string from env to number
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // validate: (config) => {
      //   const schema = Joi.object({
      //     R2_ACCESS_KEY: Joi.string().required(),
      //     R2_SECRET_KEY: Joi.string().required(),
      //     R2_BUCKET_NAME: Joi.string().required(),
      //     // Add other required vars
      //   });
      //   return schema.validate(config);
      // },
      validate: async (config: Record<string, any>) => {
        // Inject i18n service dynamically
        const i18n = await import('nestjs-i18n').then(
          (module) => new module.I18nService(),
        );
        // const { I18nService } = await import('nestjs-i18n');
        // const i18n = new I18nService();

        const requiredMessage = (field: string) =>
          i18n.translate('validation.required', { args: { field } });

        // Define the Zod schema for your configuration dynamically
        const configurationSchema = z.object({
          R2_ACCESS_KEY: z
            .string()
            .min(1, { message: requiredMessage('R2_ACCESS_KEY') }),
          R2_SECRET_KEY: z
            .string()
            .min(1, { message: requiredMessage('R2_SECRET_KEY') }),
          R2_BUCKET_NAME: z
            .string()
            .min(1, { message: requiredMessage('R2_BUCKET_NAME') }),
        });

        try {
          // Validate config using Zod
          const validatedConfig = configurationSchema.parse(config);
          return validatedConfig;
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(
              (e) => `${e.path.join('.')}: ${e.message}`,
            );
            console.error(
              'Configuration validation error:',
              JSON.stringify(error.flatten(), null, 2),
            );
            throw new Error(
              `Configuration validation failed:\n${errorMessages.join('\n')}`,
            );
          }
          throw error;
        }
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default', // Name is required in v4+
        ttl: 60000, // TTL in milliseconds (60 seconds)
        limit: 10, // Max requests per TTL window
      },
    ]),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        CookieResolver,
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
        GrpcMetadataResolver,
      ],
    }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: configService.getOrThrow('FALLBACK_LANGUAGE'),
        loaderOptions: {
          path: path.join(__dirname, '/i18n/'),
          watch: true,
        },
      }),
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    UsersService,
    VirusScanService,
    DBHelper,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService, DBHelper], // Export if other modules need it
  controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
