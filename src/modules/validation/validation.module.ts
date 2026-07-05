import { Module } from '@nestjs/common';
import { ValidationController } from './controllers/validation.controller';
import { ValidationService } from './services/validation.service';
import { PrismaModule } from 'modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
