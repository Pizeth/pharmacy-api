import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { JwtModule, JwtService } from '@nestjs/jwt';
// import { TokenService } from 'src/commons/services/token.service';
// import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { PrismaService } from '../services/prisma.service';
import { PrismaModule } from '../prisma.module';
// import { logger } from 'nestjs-i18n/dist/utils';
import { configurationSchema } from 'validation/configuration.schema';
import z, { ZodError } from 'zod';
import { ClsModule, ClsService } from 'nestjs-cls';
// import { TimeParserService } from 'modules/time-parser/services/time-parser.service/time-parser.service';
import { ValidationError } from 'exceptions/zod-validatoin.exception';
import { TimeParserModule } from 'modules/time-parser/time-parser.module';
import { CacheModule } from 'modules/cache/cache.module';
import { CryptoService } from 'commons/services/crypto.service';

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
          Logger.log('✅ Configuration validation successful', 'SeederModule');
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
          Logger.error(
            '❌ Unexpected fatal error encountered during configuration validation:',
            error,
            'SeederModule',
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
    // JwtModule,
    // ClsModule,
    // CacheModule,
    // TimeParserModule,
  ],
  providers: [CryptoService, RoleSeeder, UserSeeder, Seeder],
  exports: [Seeder],
})
export class SeederModule {}
