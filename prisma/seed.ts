process.env.NEST_DEBUG = 'true';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Seeder } from '../src/prisma/seeders/seeder'; // Adjust path if needed
import { SeederModule } from 'src/prisma/seeders/seeder.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenService } from 'src/services/token.service';
import { PasswordUtils } from 'src/utils/password-utils.service';
import { ConfigService } from '@nestjs/config';

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
    // const prismaService = app.get(PrismaService);
    // logger.debug(`PrismaService resolved from context: ${!!prismaService}`);

    // Test resolution of all critical services
    const services = [
      PrismaService,
      ConfigService,
      TokenService,
      PasswordUtils,
      Seeder,
    ];

    for (const service of services) {
      try {
        const instance: unknown = app.get(service);
        logger.debug(`Current service name: ${service.name}`);
        logger.debug(`${service.name} resolved: ${!!instance}`);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        logger.error(`❌ Failed to resolve ${service.name}: ${errorMessage}`);
      }
    }

    logger.log('✅ All base services resolved successfully.');

    const seeder = app.get(Seeder);
    logger.debug(`Seeder resolved from context: ${!!seeder}`);
    logger.debug('Resolved Seeder instance:', seeder);
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
