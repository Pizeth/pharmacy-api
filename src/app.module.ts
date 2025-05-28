import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service'; // Adjust path as needed
import { UsersService } from './user.service';
import { DBHelper } from './Utils/DBHelper';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [PrismaService, UsersService, DBHelper],
  exports: [PrismaService, DBHelper], // Export if other modules need it
  controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
