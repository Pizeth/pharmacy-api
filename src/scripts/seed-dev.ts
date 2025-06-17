import { NestFactory } from '@nestjs/core';
import { SeedService } from '../modules/prisma/seeders/seed.service';
import { AppModule } from 'src/app.module';

async function seedDevelopment() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(SeedService);

  try {
    console.log('🧹 Clearing existing data...');
    await seedService.clearAll();

    console.log('🌱 Seeding development data...');
    await seedService.seedAll();

    console.log('✅ Development seeding completed');
  } catch (error) {
    console.error('❌ Development seeding failed:', error);
  } finally {
    await app.close();
  }
}

seedDevelopment().catch((error) => {
  console.error('Failed to seed development data:', error);
  process.exit(1);
});
