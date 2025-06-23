import { Module } from '@nestjs/common';
import { R2Service } from './services/cloudflare-r2.service';
import { VirusScanService } from 'src/commons/services/virus-scan.service';
import { FilesController } from './controllers/files-upload.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [R2Service, VirusScanService],
  exports: [R2Service, VirusScanService, HttpModule],
  controllers: [FilesController],
})
export class FileModule {}
