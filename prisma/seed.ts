// prisma/seed.ts

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Seeder } from 'modules/prisma/seeders/seeder';
import type { SeedCommand } from 'modules/prisma/seeders/seeder';
import { SeederModule } from 'modules/prisma/seeders/seeder.module';

const logger = new Logger('PrismaSeeder');

/**
 * Convert an unknown caught value into useful logger text without introducing `any`.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

/**
 * Handle truly uncaught asynchronous failures.
 */
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection.', describeError(reason));
  process.exitCode = 1;
});

/**
 * Handle truly uncaught synchronous failures.
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception.', error.stack ?? error.message);
  process.exitCode = 1;
});

/**
 * Resolve the requested CLI operation.
 *
 * Supported:
 *
 *   --seed
 *   --translations
 *   --clear
 */
function resolveCommand(): SeedCommand | undefined {
  if (process.argv.includes('--clear')) {
    return 'clear';
  }

  if (process.argv.includes('--translations')) {
    return 'translations';
  }

  if (process.argv.includes('--permissions')) {
    return 'permissions';
  }

  if (process.argv.includes('--seed')) {
    return 'seed';
  }

  return undefined;
}

/**
 * Standalone Nest application-context bootstrap.
 *
 * This intentionally does NOT start the HTTP server.
 */
async function bootstrap(): Promise<void> {
  let appContext: INestApplicationContext | undefined;

  try {
    appContext = await NestFactory.createApplicationContext(SeederModule, {
      logger: ['error', 'warn', 'debug', 'log'],
    });

    logger.log('Initializing database seeder...');

    /**
     * Resolve Seeder from the DI container.
     */
    const seeder = appContext.get(Seeder, { strict: false });

    logger.debug(`Seeder resolved from context: ${!!seeder}`);
    logger.log('🌱 Starting database seeding...');

    const command = resolveCommand();

    if (!command) {
      logger.warn(
        'No command specified. Use --seed, --permissions, --translations, or --clear.',
      );

      return;
    }

    logger.log(`Executing database command: ${command}`);

    await seeder.run(command);

    logger.log('✅ Database seeding script finished successfully.');
  } catch (error: unknown) {
    logger.error('❌ Database seeding script failed.', describeError(error));

    /**
     * Do not call process.exit() from inside lifecycle management.
     *
     * Assigning exitCode lets Node finish pending output and lets the
     * finally block close Nest cleanly.
     */
    process.exitCode = 1;
  } finally {
    if (appContext) {
      await appContext.close();
    }
  }
}

/**
 * Deliberately discard the top-level Promise.
 *
 * bootstrap() manages its own failures and assigns process.exitCode.
 */
void bootstrap();
