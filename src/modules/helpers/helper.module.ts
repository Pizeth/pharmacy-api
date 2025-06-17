import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DBHelper } from './services/db-helper';

@Module({
  imports: [PrismaModule],
  providers: [DBHelper],
  exports: [DBHelper],
})
export class DBHelperModule {}
