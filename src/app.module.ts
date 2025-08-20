import { Module, Logger as l } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { z, ZodError } from 'zod';
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
import { FileModule } from './modules/files/file.module';
import { ClsModule } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { AuthModule } from './modules/auth/auth.module';
import { TimeParserModule } from './modules/time-parser/time-parser.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { ValidationError } from './exceptions/zod-validatoin.exception';
import { ProfileModule } from './profile/profile.module';
import oidcProviderConfig from './modules/ocid/configs/oidc.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [oidcProviderConfig], // Load custom config factory
      validate: (config: Record<string, any>) => {
        // l.log(config);
        try {
          const validatedConfig = configurationSchema.parse(config);
          console.log('✅ Configuration validation successful');
          return validatedConfig;
        } catch (error: unknown) {
          l.log(error);
          if (error instanceof ZodError) {
            // // const errorMessages = error.errors.map((e) => {
            // const errorMessages = error.issues.map((e) => {
            //   // e.message already contains the internationalized message from our helpers
            //   return `${e.path.join('.')}: ${e.message}`;
            // });
            // // const errorMessages = error.errors.map(
            // //   (e) => `${e.path.join('.')}: ${e.message}`,
            // // );
            // console.error(
            //   '❌ Configuration validation error details:',
            //   JSON.stringify(z.treeifyError(error), null, 2),
            //   // JSON.stringify(error.flatten(), null, 2),
            // );
            // throw new Error(
            //   `Configuration validation failed:\n${errorMessages.join('\n')}`,
            // );
            if (error instanceof ZodError) {
              throw new ValidationError(error, z.treeifyError);
            }
          }
          console.error(
            '❌ Unexpected error during configuration validation:',
            error,
          );
          throw error; // Re-throw other unexpected errors
        }
      },
    }),
    // Setup ClsModule globally.
    ClsModule.forRoot({
      global: true, // Make the ClsService available everywhere
      middleware: {
        // Mount the middleware automatically for all routes
        mount: true,
        // This function runs for every request
        // Here, we can extract data from the request and store it in the context
        // setup: (cls, req: { ip?: string; headers: Record<string, any> }) => {
        setup: (cls, req: Request) => {
          cls.set('ip', req.ip);
          cls.set('userId', req.headers['x-user-id']);
          cls.set('correlationId', req.headers['x-correlation-id'] ?? uuidv4());
          cls.set('userAgent', req.headers['user-agent']);
          cls.set('url', req.url);
          cls.set('method', req.method);
          // If you use an auth guard that sets `req.user`, you can set it here too
          // cls.set('user', req.user);
        },
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

    // JwtModule.registerAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     secret: config.get('SECRET_KEY'),
    //     signOptions: { expiresIn: config.get('EXPIRES_IN') },
    //   }),
    // }),
    // PrismaModule,
    // HttpModule,
    AuthModule,
    FileModule,
    TimeParserModule,
    ProfileModule,
    // CacheModule,
    // SuggestionModule,
  ],
  providers: [
    // Logger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
  exports: [], // Export if other modules need it
  // controllers: [UserController],
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
