import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DBHelper } from './services/db-helper';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [DBHelper],
  exports: [DBHelper, PrismaModule],
})
export class DBHelperModule {}
