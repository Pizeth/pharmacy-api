// -----------------------------------------------------------------
// The Time Parser Module
// Location: src/utils/time-parser.module.ts
// -----------------------------------------------------------------
import { Global, Module } from '@nestjs/common';
import { TimeParserService } from './services/time-parser.service/time-parser.service';

@Global() // Make this utility service available everywhere
@Module({
  providers: [TimeParserService],
  exports: [TimeParserService],
})
export class TimeParserModule {}
