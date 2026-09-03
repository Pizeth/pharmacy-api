import {
  Module,
  StandardSchemaValidationPipe,
  Logger as l,
} from '@nestjs/common';
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
import { v7 as uuidv7 } from 'uuid';
import { Request } from 'express';
import { AuthModule } from './modules/auth/auth.module';
import { TimeParserModule } from './modules/time-parser/time-parser.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { ValidationError } from './exceptions/zod-validatoin.exception';
import { ProfileModule } from './modules/profiles/profile.module';
import { AppController } from 'app.controller';
import { AppService } from 'app.service';
import { HealthModule } from './modules/health/health.module';
import { ImagesModule } from 'modules/images/image.module';
import { ApiModule } from './modules/api/api.module';
import { ValidationModule } from './modules/validation/validation.module';
import { TranslationModule } from 'modules/i18n/translation.module';
// import { Prisma } from 'generated/prisma/client';
// import { PrismaModule } from 'modules/prisma/prisma.module';
import { DBHelperModule } from 'modules/helpers/helper.module';
import { ResendModule } from './modules/email/resend.module';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
// import oidcProviderConfig from './modules/ocid/configs/oidc.config';

// Force absolute path regardless of __dirname resolution
// const i18nPath =
//   process.env.I18N_PATH ?? path.join(process.cwd(), 'dist/i18n/');
// console.log('__dirname:', __dirname);
// console.log('process.cwd():', process.cwd());
// console.log('NODE_ENV:', process.env.NODE_ENV);
// console.log(
//   'i18nPath will be:',
//   process.env.NODE_ENV === 'production'
//     ? (process.env.I18N_PATH ?? path.join(process.cwd(), 'dist/i18n/'))
//     : path.join(__dirname, 'i18n'),
// );

console.log('import.meta.dirname:', import.meta.dirname);

console.log('process.cwd():', process.cwd());

console.log('NODE_ENV:', process.env.NODE_ENV);

// const i18nPath =
//   process.env.NODE_ENV === 'production'
//     ? (process.env.I18N_PATH ?? path.join(process.cwd(), 'dist/i18n/'))
//     : path.join(__dirname, 'i18n'); // or wherever it works in dev

const i18nPath =
  process.env.I18N_PATH ??
  path.resolve(
    process.cwd(),
    process.env.NODE_ENV === 'production' ? 'dist/i18n' : 'src/i18n',
  );

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // load: [oidcProviderConfig], // Load custom config factory
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
    // ConfigModule.forRoot({
    //   /**
    //    * Make ConfigService available application-wide.
    //    */
    //   isGlobal: true,

    //   /**
    //    * Explicit environment file used by the application.
    //    */
    //   envFilePath: '.env',

    //   /**
    //    * NestJS 12 accepts Standard Schema implementations directly.
    //    *
    //    * Zod 4 satisfies that contract, so configurationSchema is both:
    //    *
    //    *   - runtime validation
    //    *   - transformation/default source
    //    *   - inferred TypeScript source
    //    */
    //   validationSchema: configurationSchema,
    // }),
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
          cls.set('correlationId', req.headers['x-correlation-id'] ?? uuidv7());
          cls.set('userAgent', req.headers['user-agent']);
          cls.set('acceptLanguage', req.headers['accept-language']);
          cls.set('referer', req.headers['referer']);
          cls.set('origin', req.headers['origin']);
          cls.set('url', req.url);
          cls.set('method', req.method);
          cls.set('user', req.user);

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
        // path: path.join(__dirname, '/i18n/'),
        // watch: true,
        path: i18nPath,
        watch: process.env.NODE_ENV !== 'production', // 👈 disable in prod
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        CookieResolver,
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
        GrpcMetadataResolver,
      ],
    }),
    DBHelperModule,
    AuthModule,
    FileModule,
    ImagesModule,
    TimeParserModule,
    ProfileModule,
    HealthModule,
    ApiModule,
    ValidationModule,
    TranslationModule,
    ResendModule,
    AuthorizationModule,
  ],
  providers: [
    /**
     * Global rate-limiting guard.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    /**
     * --------------------------------------------------------------
     * Transitional compatibility for existing routes that still use
     * nestjs-zod DTOs.
     * --------------------------------------------------------------
     *
     * Keep this temporarily for existing routes that still use:
     *
     *   createZodDto(...)
     *
     * and the nestjs-zod DTO integration.
     *
     * Once those routes have migrated to NestJS 12 native
     * Standard Schema metadata, this provider and the nestjs-zod
     * package can be removed.
     */
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },

    /**
     * --------------------------------------------------------------
     * NestJS 12 native Standard Schema validation
     * --------------------------------------------------------------
     *
     * Handles schemas attached directly through:
     *
     *   @Body({ schema })
     *   @Query({ schema })
     *   @Param(..., { schema })
     *   @RawBody({ schema })
     *
     * Zod 4 implements the Standard Schema contract natively.
     */
    {
      provide: APP_PIPE,
      useClass: StandardSchemaValidationPipe,
    },
    AppService,
  ],
  exports: [], // Export if other modules need it
  controllers: [AppController],
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
