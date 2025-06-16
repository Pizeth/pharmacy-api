import { Module, Logger as l } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { UsersService } from './users/services/users.service';
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
import { Logger } from './logs/logger';
import { TokenService } from './services/token.service';
import { PasswordUtils } from './utils/password-utils.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { UserController } from './users/users.constroler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_KEY'),
        signOptions: { expiresIn: config.get('EXPIRES_IN') },
      }),
    }),
    PrismaModule,
    HttpModule,
    // SeedModule,
  ],
  providers: [
    UsersService,
    VirusScanService,
    TokenService,
    PasswordUtils,
    DBHelper,
    Logger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    UsersService,
    VirusScanService,
    TokenService,
    PasswordUtils,
    DBHelper,
    Logger,
    HttpModule,
  ], // Export if other modules need it
  controllers: [UserController],
})
export class AppModule {}

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
