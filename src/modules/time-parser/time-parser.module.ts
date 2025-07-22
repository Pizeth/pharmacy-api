// -----------------------------------------------------------------
// The Time Parser Module
// Location: src/utils/time-parser.module.ts
// -----------------------------------------------------------------
import { Global, Module } from '@nestjs/common';
import { TimeParserService } from './services/time-parser.service/time-parser.service';
import { SuggestionService } from './services/suggestion/suggestion.service';
import { LocalizationService } from './services/localization/localization.service';
import { TimeParserConfigService } from './configurations/time-parser.config/time-parser.config.service';
import { CacheModule } from '../cache/cache.module';

@Global() // Make this utility service available everywhere
@Module({
  imports: [CacheModule], // Import any necessary modules, e.g., cache
  providers: [
    TimeParserService,
    SuggestionService,
    LocalizationService,
    TimeParserConfigService,
  ],
  exports: [TimeParserService],
})
export class TimeParserModule {}
