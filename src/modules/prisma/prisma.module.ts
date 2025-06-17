import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';

@Global() // Making this global is a robust pattern for Prisma
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
