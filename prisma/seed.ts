// import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SeedService } from '../src/prisma/seeders/seed.service';

async function bootstrap() {
  // Create NestJS application context to access services
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(SeedService);
  //   const configService = app.get(ConfigService);

  try {
    console.log('🌱 Starting database seeding...');

    // Run all seeders
    await seedService.seedAll();

    console.log('✅ Database seeding completed successfully');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('❌ Seeding process failed:', error);
  process.exit(1);
});
