// import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
// import { AppModule } from '../src/app.module';
import { SeedService } from '../src/prisma/seeders/seed.service';
import { SeedModule } from 'src/prisma/seeders/seed.module';

async function bootstrap() {
  // Create NestJS application context to access services
  const app = await NestFactory.createApplicationContext(SeedModule);
  // const seedService = app.get(SeedService);
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

  try {
    const seedService = app.get(SeedService);
    console.log('🌱 Starting database seeding...');

    // Handle command line arguments
    if (process.argv.includes('--clear')) {
      console.log('🧹 Clearing database...');
      await seedService.clearAll();
    }

    if (process.argv.includes('--seed')) {
      console.log('🌱 Seeding database...');
      await seedService.seedAll();
    }

    console.log('✅ Database Seeding completed successfully');
  } catch (error) {
    console.error('❌ Database Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('❌ Seeding process failed:', error);
  process.exit(1);
});
