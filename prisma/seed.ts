// // import { ConfigService } from '@nestjs/config';
// import 'reflect-metadata';
// import { NestFactory } from '@nestjs/core';
// // import { AppModule } from '../src/app.module';
// import { SeedService } from '../src/prisma/seeders/seed.service';
// import { Logger } from '@nestjs/common';
// import { SeedModule } from 'src/prisma/seeders/seed.module';

// const logger = new Logger(bootstrap.name);

// async function bootstrap() {
//   // Create NestJS application context to access services
//   const app = await NestFactory.createApplicationContext(SeedModule);
//   const seedService = app.get(SeedService);
//   // const seedService = app.select(SeedModule).get(SeedService, { strict: true });
//   logger.debug('Resolved SeedService instance:', seedService); // Check the log for this!

//   try {
//     // const seedService = app.get(SeedService);
//     logger.log('🌱 Starting database seeding...');

//     // Handle command line arguments
//     if (process.argv.includes('--clear')) {
//       logger.log('🧹 Clearing database...');
//       await seedService.clearAll();
//     }

//     if (process.argv.includes('--seed')) {
//       logger.log('🌱 Seeding database...');
//       await seedService.seedAll();
//     }

//     logger.log('✅ Database Seeding completed successfully');
//   } catch (error) {
//     logger.error('❌ Database Seeding failed:', error);
//     process.exit(1);
//   } finally {
//     await app.close();
//   }
// }

// bootstrap().catch((error) => {
//   logger.error('❌ Seeding process failed:', error);
//   process.exit(1);
// });

//   const configService = app.get(ConfigService);

// try {
//   console.log('🌱 Starting database seeding...');

//   // Run all seeders
//   await seedService.seedAll();

//   console.log('✅ Database seeding completed successfully');
// } catch (error) {
//   console.error('❌ Database seeding failed:', error);
//   throw error;
// } finally {
//   await app.close();
// }

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Seeder } from '../src/prisma/seeders/seeder'; // Adjust path if needed
import { SeederModule } from 'src/prisma/seeders/seeder.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenService } from 'src/services/access-token.service';
import { PasswordUtils } from 'src/utils/password-utils.service';

const logger = new Logger('PrismaSeeder');

async function bootstrap() {
  let app;
  try {
    app = await NestFactory.createApplicationContext(SeederModule, {
      // Disable logging from the NestJS core to make our own logs cleaner
      logger: ['error', 'warn', 'debug'],
    });

    logger.log('Seeder application context created successfully.');

    // Add this debug check
    const prismaService = app.get(PrismaService);
    logger.debug(`PrismaService resolved from context: ${!!prismaService}`);

    const tokenService = app.get(TokenService);
    const passwordUtils = app.get(PasswordUtils);
    logger.debug(`TokenService resolved from context: ${!!tokenService}`);
    logger.debug(`PasswordUtils resolved from context: ${!!passwordUtils}`);
    logger.debug('Resolved TokenService instance:', tokenService);
    logger.debug('Resolved PasswordUtils instance:', passwordUtils);

    const seeder = app.get(Seeder);
    logger.debug(`Seeder resolved from context: ${!!seeder}`);
    logger.debug('Resolved Seeder instance:', seeder);

    // Initialize the seeder explicitly
    // await seeder.initialize();

    if (process.argv.includes('--clear')) {
      await seeder.run('clear');
    } else if (process.argv.includes('--seed')) {
      await seeder.run('seed');
    } else {
      logger.warn(
        'No command specified. Use --seed to seed or --clear to clear the database.',
      );
    }

    logger.log('✅ Database Seeding script finished successfully.');
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database Seeding script failed:', error);
    if (app) await app.close();
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  logger.error('❌ Seeding process failed:', error);
  process.exit(1);
});
