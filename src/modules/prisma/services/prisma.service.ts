import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    this.logger.debug('PrismaService instance created');
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database');
    } catch (error) {
      this.logger.error('Failed to connect to the database', error);
      // You might want to throw the error or handle it more gracefully
      // depending on your application's needs.
      // For example, process.exit(1) if the DB connection is critical at startup.
      throw error; // Re-throwing is often a good idea if the app can't run without DB
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Successfully disconnected from the database');
  }
}
