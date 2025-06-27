// -----------------------------------------------------------------
// The Images Module
// Location: src/modules/images/images.module.ts
// -----------------------------------------------------------------
// This module bundles the controller and service together.

import { Module } from '@nestjs/common';
import { ImagesController } from './controllers/images.controller';
import { ImagesService } from './services/images.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService], // Export the service if other modules need to generate avatars
})
export class ImagesModule {}
