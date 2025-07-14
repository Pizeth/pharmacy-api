import { Module } from '@nestjs/common';
import { ServicesService } from './services/services.service';

@Module({
  providers: [ServicesService]
})
export class CacheModule {}
