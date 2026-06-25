import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // constructor() {
  //   super();
  //   this.logger.debug('PrismaService instance created');
  // }

  constructor() {
    // 1. Ensure the connection string exists
    const poolConfig = process.env.DATABASE_URL;
    if (!poolConfig) {
      throw new Error('DATABASE_URL environment variable is missing!');
    }

    // 2. Pass the connection string directly into the PrismaPg constructor
    const adapter = new PrismaPg(poolConfig);

    // 3. Pass the adapter to super()
    super({ adapter });

    this.logger.debug(
      'PrismaService instance created with Supabase connection string',
    );
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
