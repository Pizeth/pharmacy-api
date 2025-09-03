import { Module } from '@nestjs/common';
import { Seeder } from './seeder';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TokenService } from 'src/commons/services/token.service';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { PrismaService } from '../services/prisma.service';
import { PrismaModule } from '../prisma.module';
import { logger } from 'nestjs-i18n';
import { configurationSchema } from 'src/validation/configuration.schema';
import z, { ZodError } from 'zod';
import { ClsModule, ClsService } from 'nestjs-cls';
import { TimeParserService } from 'src/modules/time-parser/services/time-parser.service/time-parser.service';
import { ValidationError } from 'src/exceptions/zod-validatoin.exception';
import { TimeParserModule } from 'src/modules/time-parser/time-parser.module';
import { CacheModule } from 'src/modules/cache/cache.module';
import { CryptoService } from 'src/commons/services/crypto.service';

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
          logger.error(
            '❌ Unexpected error during configuration validation:',
            error,
          );
          throw error; // Re-throw other unexpected errors
        }
      },
    }),
    // Configure JwtModule here as well, since TokenService depends on it.
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     secret: config.get('SECRET_KEY'), // Or a default for seeding
    //     signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
    //   }),
    // }),
    // Setup ClsModule globally.
    // ClsModule.forRoot({
    //   global: true, // Make the ClsService available everywhere
    //   middleware: {
    //     // Mount the middleware automatically for all routes
    //     mount: true,
    //     // This function runs for every request
    //     // Here, we can extract data from the request and store it in the context
    //     // setup: (cls, req: { ip?: string; headers: Record<string, any> }) => {
    //     setup: (cls, req: Request) => {
    //       cls.set('ip', req.ip);
    //       cls.set('userId', req.headers['x-user-id']);
    //       cls.set('correlationId', req.headers['x-correlation-id'] ?? uuidv4());
    //       cls.set('userAgent', req.headers['user-agent']);
    //       cls.set('url', req.url);
    //       cls.set('method', req.method);
    //       // If you use an auth guard that sets `req.user`, you can set it here too
    //       // cls.set('user', req.user);
    //     },
    //   },
    // }),
    // UserModule,
    JwtModule,
    ClsModule,
    CacheModule,
    TimeParserModule,
  ],
  providers: [
    // // We define a custom factory for our main Seeder class.
    {
      provide: TokenService,
      useFactory: (
        // The factory function receives the fully resolved dependencies as arguments.
        prisma: PrismaService,
        config: ConfigService,
        jwt: JwtService,
        parser: TimeParserService,
        cls: ClsService,
      ) => {
        // 1. Manually create the main TokenService instance, passing in the helper instances.
        return new TokenService(config, prisma, jwt, parser, cls);
      },
      // 2. List all the dependencies that the factory needs. NestJS will resolve these first.
      inject: [
        PrismaService,
        ConfigService,
        JwtService,
        TimeParserService,
        ClsService,
      ],
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
    // {
    //   provide: PasswordUtils,
    //   useFactory: (config: ConfigService) => {
    //     console.log('[BOOT] PasswordUtils factory start');
    //     const csv = new PasswordUtils(config);
    //     console.log('[BOOT] PasswordUtils factory done');
    //     return csv;
    //   },
    //   inject: [ConfigService],
    // },
    // {
    //   provide: TokenService,
    //   useFactory: (
    //     config: ConfigService,
    //     prisma: PrismaService,
    //     jwt: JwtService,
    //     parser: TimeParserService,
    //     cls: ClsService,
    //   ) => {
    //     console.log('[BOOT] TokenService factory start');
    //     const csv = new TokenService(config, prisma, jwt, parser, cls);
    //     console.log('[BOOT] TokenService factory done');
    //     return csv;
    //   },
    // },
    {
      provide: Seeder,
      useFactory: (
        // The factory function receives the fully resolved dependencies as arguments.
        prisma: PrismaService,
        config: ConfigService,
        tokenService: TokenService,
        passwordUtils: PasswordUtils,
        cryptoService: CryptoService,
      ) => {
        // 1. Manually create the main Seeder instance, passing in the helper instances.
        return new Seeder(
          prisma,
          config,
          tokenService,
          passwordUtils,
          cryptoService,
        );
      },
      // 2. List all the dependencies that the factory needs. NestJS will resolve these first.
      inject: [
        PrismaService,
        ConfigService,
        TokenService,
        PasswordUtils,
        CryptoService,
      ],
    },
    // Seeder,
  ],
  exports: [Seeder],
})
export class SeederModule {}
