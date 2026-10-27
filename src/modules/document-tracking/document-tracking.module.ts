import { FileModule } from 'modules/files/file.module';
import { Module } from '@nestjs/common';
import { DBHelperModule } from 'modules/helpers/helper.module';
import { DocumentTrackingController } from './document-tracking.controller';
import { DocumentTrackingService } from './document-tracking.service';
@Module({
  imports: [DBHelperModule, FileModule],
  controllers: [DocumentTrackingController],
  providers: [DocumentTrackingService],
})
export class DocumentTrackingModule {}
