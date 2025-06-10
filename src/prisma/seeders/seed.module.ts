import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { PrismaModule } from '../src/prisma/prisma.module'; // Adjust path
import { PrismaModule } from '../prisma.module';
import { SeedService } from './seed.service';
import { UserSeeder } from './user.seeder';
import { RoleSeeder } from './role.seeder';
import configuration from 'src/configs/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration], // Load your configuration
      envFilePath: '.env', // Explicitly specify env file path
    }),
    PrismaModule,
  ],
  providers: [SeedService, UserSeeder, RoleSeeder],
  exports: [SeedService],
})
export class SeedModule {}
