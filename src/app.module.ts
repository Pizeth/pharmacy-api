import { Module, Logger as l } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
// import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service'; // Adjust path as needed
import { UsersService } from './user.service';
import { DBHelper } from './utils/db-helper';
import { VirusScanService } from './services/virus-scan.service';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ZodError } from 'zod'; // Import Zod
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
  CookieResolver,
  GrpcMetadataResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { configurationSchema } from './validation/configuration.schema';
import { SeedModule } from './prisma/seeders/seed.module';
import { Logger } from './logs/logger';
import { TokenService } from './services/access-token.service';
import { PasswordUtils } from './utils/password-utils.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // validate: async (config: Record<string, any>) => {
      //   // Inject i18n service dynamically
      //   const i18n = await import('nestjs-i18n').then(
      //     (module) => new module.I18nService(),
      //   );
      //   // const { I18nService } = await import('nestjs-i18n');
      //   // const i18n = new I18nService();

      //   const requiredMessage = (field: string) =>
      //     i18n.translate('validation.required', { args: { field } });

      //   // Define the Zod schema for your configuration dynamically
      //   const configurationSchema = z.object({
      //     R2_ACCESS_KEY: z
      //       .string()
      //       .min(1, { message: requiredMessage('R2_ACCESS_KEY') }),
      //     R2_SECRET_KEY: z
      //       .string()
      //       .min(1, { message: requiredMessage('R2_SECRET_KEY') }),
      //     R2_BUCKET_NAME: z
      //       .string()
      //       .min(1, { message: requiredMessage('R2_BUCKET_NAME') }),
      //   });

      //   try {
      //     // Validate config using Zod
      //     const validatedConfig = configurationSchema.parse(config);
      //     return validatedConfig;
      //   } catch (error: unknown) {
      //     if (error instanceof z.ZodError) {
      //       const errorMessages = error.errors.map(
      //         (e) => `${e.path.join('.')}: ${e.message}`,
      //       );
      //       console.error(
      //         'Configuration validation error:',
      //         JSON.stringify(error.flatten(), null, 2),
      //       );
      //       throw new Error(
      //         `Configuration validation failed:\n${errorMessages.join('\n')}`,
      //       );
      //     }
      //     throw error;
      //   }
      // },
      validate: (config: Record<string, any>) => {
        // l.log(config);
        try {
          const validatedConfig = configurationSchema.parse(config);
          console.log('✅ Configuration validation successful');
          return validatedConfig;
        } catch (error: unknown) {
          l.log(error);
          if (error instanceof ZodError) {
            const errorMessages = error.errors.map((e) => {
              // e.message already contains the internationalized message from our helpers
              return `${e.path.join('.')}: ${e.message}`;
            });
            // const errorMessages = error.errors.map(
            //   (e) => `${e.path.join('.')}: ${e.message}`,
            // );
            console.error(
              '❌ Configuration validation error details:',
              JSON.stringify(error.flatten(), null, 2),
            );
            throw new Error(
              `Configuration validation failed:\n${errorMessages.join('\n')}`,
            );
          }
          console.error(
            '❌ Unexpected error during configuration validation:',
            error,
          );
          throw error; // Re-throw other unexpected errors
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
    // I18nModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => ({
    //     fallbackLanguage: configService.getOrThrow('FALLBACK_LANGUAGE'),
    //     loaderOptions: {
    //       path: path.join(__dirname, '/i18n/'),
    //       watch: true,
    //     },
    //   }),
    //   resolvers: [
    //     { use: QueryResolver, options: ['lang'] },
    //     AcceptLanguageResolver,
    //     new HeaderResolver(['x-lang']),
    //   ],
    //   inject: [ConfigService],
    // }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_KEY'),
        signOptions: { expiresIn: config.get('EXPIRES_IN') },
      }),
    }),
    SeedModule,
  ],
  providers: [
    PrismaService,
    UsersService,
    VirusScanService,
    TokenService,
    PasswordUtils,
    DBHelper,
    // SeedService,
    // UserSeeder,
    // RoleSeeder,
    Logger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    PrismaService,
    UsersService,
    VirusScanService,
    TokenService,
    PasswordUtils,
    DBHelper,
    Logger,
  ], // Export if other modules need it
  controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
