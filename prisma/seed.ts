import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  Logger,
  // DynamicModule, ForwardReference, Type
} from '@nestjs/common';
import { Seeder } from 'modules/prisma/seeders/seeder'; // Adjust path if needed
import { SeederModule } from 'modules/prisma/seeders/seeder.module';
// import { INestApplicationContext } from '@nestjs/common';
const logger = new Logger('PrismaSeeder');

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason as any);
});
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
});

// type IEntryNestModule =
//   | Type<any>
//   | DynamicModule
//   | ForwardReference
//   | Promise<IEntryNestModule>;

// async function createContextWithTimeout(
//   module: IEntryNestModule, // Use 'any' or a more specific type if available, like Type<any>
//   ms = 5000,
// ): Promise<INestApplicationContext> {
//   return Promise.race([
//     NestFactory.createApplicationContext(module, {
//       logger: ['error', 'warn', 'debug', 'log'],
//     }),
//     new Promise<INestApplicationContext>((_, reject) =>
//       setTimeout(
//         () =>
//           reject(new Error(`createApplicationContext timed out after ${ms}ms`)),
//         ms,
//       ),
//     ),
//   ]);
// }

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(SeederModule, {
    // Disable logging from the NestJS core to make our own logs cleaner
    logger: ['error', 'warn', 'debug', 'log'],
  });

  // const appContext = await createContextWithTimeout(SeederModule, 5000);

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
