// process.env.NEST_DEBUG = 'true';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  DynamicModule,
  ForwardReference,
  Logger,
  Module,
  Type,
} from '@nestjs/common';
import { Seeder } from '../src/modules/prisma/seeders/seeder'; // Adjust path if needed
import { SeederModule } from 'src/modules/prisma/seeders/seeder.module';
// import { PrismaService } from 'src/modules/prisma/services/prisma.service';
// import { TokenService } from 'src/commons/services/token.service';
// import { PasswordUtils } from 'src/commons/services/password-utils.service';
// import { ConfigService } from '@nestjs/config';
import { CacheService } from 'src/modules/cache/services/cache.service';
import { SuggestionService } from 'src/modules/suggestion/services/suggestion.service';
import { TimeParserService } from 'src/modules/time-parser/services/time-parser.service/time-parser.service';
import { INestApplicationContext } from '@nestjs/common';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { CacheModule } from 'src/modules/cache/cache.module';
import { SuggestionModule } from 'src/modules/suggestion/suggestion.module';
import { TimeParserModule } from 'src/modules/time-parser/time-parser.module';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('PrismaSeeder');

// async function bootstrap() {
//   let app;
//   try {
//     app = await NestFactory.createApplicationContext(SeederModule, {
//       // Disable logging from the NestJS core to make our own logs cleaner
//       logger: ['error', 'warn', 'debug', 'log', 'verbose', 'fatal'],
//     });

//     logger.log('Seeder application context created successfully.');

//     // Add this debug check
//     // const prismaService = app.get(PrismaService);
//     // logger.debug(`PrismaService resolved from context: ${!!prismaService}`);

//     // Test resolution of all critical services
//     const services = [
//       PrismaService,
//       ConfigService,
//       TokenService,
//       PasswordUtils,
//       Seeder,
//     ];

//     for (const service of services) {
//       try {
//         const instance: unknown = app.get(service);
//         logger.debug(`Current service name: ${service.name}`);
//         logger.debug(`${service.name} resolved: ${!!instance}`);
//       } catch (e: unknown) {
//         const errorMessage = e instanceof Error ? e.message : 'Unknown error';
//         logger.error(`❌ Failed to resolve ${service.name}: ${errorMessage}`);
//       }
//     }

//     logger.log('✅ All base services resolved successfully.');

//     const seeder = app.get(Seeder);
//     logger.debug(`Seeder resolved from context: ${!!seeder}`);
//     logger.debug('Resolved Seeder instance:', seeder);
//     logger.log('🌱 Starting database seeding...');

//     // Handle command line arguments
//     if (process.argv.includes('--clear')) {
//       logger.log('🧹 Clearing database...');
//       await seeder.run('clear');
//     } else if (process.argv.includes('--seed')) {
//       logger.log('🌱 Seeding database...');
//       await seeder.run('seed');
//     } else {
//       logger.warn(
//         'No command specified. Use --seed to seed or --clear to clear the database.',
//       );
//     }

//     logger.log('✅ Database Seeding script finished successfully.');
//     await app.close();
//     process.exit(0);
//   } catch (error) {
//     logger.error('❌ Database Seeding script failed:', error);
//     if (app) await app.close();
//     process.exit(1);
//   }
// }

// bootstrap().catch((error) => {
//   logger.error('❌ Seeding process failed:', error);
//   process.exit(1);
// });

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason as any);
});
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
});

// Add this near top of seed.ts for diagnostic use only
async function tryBootstrapModuleSet(
  name: string,
  moduleFactory: IEntryNestModule,
  ms = 5000,
) {
  logger.log(`➡️ Trying bootstrap for: ${name}`);
  try {
    const ctx = await Promise.race([
      NestFactory.createApplicationContext(moduleFactory, {
        logger: ['error', 'warn', 'debug'],
      }),
      new Promise<INestApplicationContext>((_res, rej) =>
        setTimeout(() => rej(new Error('timeout')), ms),
      ),
    ]);
    logger.log(`✅ Bootstrap succeeded for: ${name}`);
    await ctx.close();
    return true;
  } catch (err) {
    logger.error(`❌ Bootstrap failed/timed out for: ${name}`, err);
    return false;
  }
}

async function findBlockingModule() {
  // Start with small sets and expand
  const moduleSets = [
    // Provide the module types/constructors directly (not functions that return them)
    { name: 'PrismaModule alone', factory: PrismaModule },
    {
      name: 'CacheModule alone',
      factory: (() => {
        @Module({ imports: [CacheModule] })
        class M {}
        return M;
      })(),
    },
    {
      name: 'SuggestionModule alone',
      factory: (() => {
        @Module({ imports: [SuggestionModule] })
        class M {}
        return M;
      })(),
    },
    {
      name: 'TimeParserModule alone',
      factory: (() => {
        @Module({ imports: [TimeParserModule, CacheModule, SuggestionModule] })
        class M {}
        return M;
      })(),
    },
    // { name: 'SeedHelpersModule', factory: SeedHelpersModule },
    { name: 'SeederModule (full)', factory: SeederModule },
  ];

  for (const set of moduleSets) {
    const ok = await tryBootstrapModuleSet(set.name, set.factory, 15000);
    if (!ok) {
      logger.log(
        `→ The blocker is likely inside or a dependency of: ${set.name}`,
      );
      break;
    }
  }
}

type IEntryNestModule =
  | Type<any>
  | DynamicModule
  | ForwardReference
  | Promise<IEntryNestModule>;

async function createContextWithTimeout(
  module: IEntryNestModule, // Use 'any' or a more specific type if available, like Type<any>
  ms = 5000,
): Promise<INestApplicationContext> {
  return Promise.race([
    NestFactory.createApplicationContext(module, {
      logger: ['error', 'warn', 'debug', 'log'],
    }),
    new Promise<INestApplicationContext>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`createApplicationContext timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

async function bootstrap() {
  // const appContext = await NestFactory.createApplicationContext(SeederModule, {
  //   // Disable logging from the NestJS core to make our own logs cleaner
  //   logger: ['error', 'warn', 'debug', 'log'],
  // });
  // call this helper early (for debugging only)
  await findBlockingModule();

  const appContext = await createContextWithTimeout(SeederModule, 5000);

  // const probes = [
  //   ConfigService,
  //   PrismaService,
  //   CacheService,
  //   SuggestionService,
  //   TimeParserService,
  // ];

  // for (const p of probes) {
  //   try {
  //     const inst = appContext.get(p);
  //     logger.debug(`${p.name} resolved: ${!!inst}`);
  //   } catch (e) {
  //     const errorMessage = e instanceof Error ? e.message : 'Unknown error';
  //     logger.error(`❌ Failed to resolve ${p.name}: ${errorMessage}`);
  //   }
  // }

  try {
    logger.log('Initializing the seeder...');

    // Get the SeederService from the application context
    const seeder = appContext.get(Seeder, { strict: false });
    logger.debug(`Seeder resolved from context: ${!!seeder}`);
    // logger.debug('Resolved Seeder instance:', seeder);
    logger.log('🌱 Starting database seeding...');

    // Handle command line arguments
    if (process.argv.includes('--clear')) {
      logger.log('🧹 Clearing database...');
      await seeder.run('clear');
    } else if (process.argv.includes('--seed')) {
      logger.log('🌱 Seeding database...');
      await seeder.run('seed');
    } else {
      logger.warn(
        'No command specified. Use --seed to seed or --clear to clear the database.',
      );
    }

    logger.log('✅ Database Seeding script finished successfully.');
    await appContext.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database Seeding script failed:', error);
  } finally {
    // Ensure the application context is closed when the script is done
    await appContext.close();
    process.exit(1);
  }
}

// Run the bootstrap function
bootstrap().catch((error) => {
  logger.error('❌ Seeding process failed:', error);
  process.exit(1);
});
