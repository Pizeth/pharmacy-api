import { Module, Logger as l } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
// import { Logger } from './logs/logger';
import { UserModule } from './modules/users/user.module';

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

    // JwtModule.registerAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     secret: config.get('SECRET_KEY'),
    //     signOptions: { expiresIn: config.get('EXPIRES_IN') },
    //   }),
    // }),
    // PrismaModule,
    // HttpModule,
    UserModule,
  ],
  providers: [
    // Logger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
