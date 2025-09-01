// -----------------------------------------------------------------
// The Time Parser Module
// Location: src/utils/time-parser.module.ts
// -----------------------------------------------------------------
import { forwardRef, Global, Module } from '@nestjs/common';
import { TimeParserService } from './services/time-parser.service/time-parser.service';
import { SuggestionModule } from '../suggestion/suggestion.module';
import timerParserConfig from './configs/time-parser.config';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache/cache.module';

@Global() // Make this utility service available everywhere
@Module({
  imports: [
    CacheModule,
    forwardRef(() => SuggestionModule), // safe if there's any circular
    ConfigModule.forFeature(timerParserConfig),
  ], // Import any necessary modules, e.g., cache
  providers: [TimeParserService],
  exports: [TimeParserService, SuggestionModule],
})
export class TimeParserModule {}
