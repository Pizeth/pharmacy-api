import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service'; // Adjust path as needed
import { UsersService } from './user.service';
import { DBHelper } from './utils/db-helper';
import { VirusScanService } from './services/virus-scan.service';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => {
        const schema = Joi.object({
          R2_ACCESS_KEY: Joi.string().required(),
          R2_SECRET_KEY: Joi.string().required(),
          R2_BUCKET_NAME: Joi.string().required(),
          // Add other required vars
        });
        return schema.validate(config);
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default', // Name is required in v4+
        ttl: 60000, // TTL in milliseconds (60 seconds)
        limit: 10, // Max requests per TTL window
      },
    ]),
  ],
  providers: [
    PrismaService,
    UsersService,
    VirusScanService,
    DBHelper,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService, DBHelper], // Export if other modules need it
  controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
