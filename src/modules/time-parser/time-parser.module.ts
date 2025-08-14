// -----------------------------------------------------------------
// The Time Parser Module
// Location: src/utils/time-parser.module.ts
// -----------------------------------------------------------------
import { Global, Module } from '@nestjs/common';
import { TimeParserService } from './services/time-parser.service/time-parser.service';
// import { SuggestionService } from './services/suggestion/suggestion.service';
import { LocalizationService } from './services/localization/localization.service';
// import { TimeParserConfigService } from './configurations/time-parser.config/time-parser.config.service';
import { SuggestionModule } from '../suggestion/suggestion.module';
import timerParserConfig from './configs/time-parser.config';
import { ConfigModule } from '@nestjs/config';

@Global() // Make this utility service available everywhere
@Module({
  imports: [SuggestionModule, ConfigModule.forFeature(timerParserConfig)], // Import any necessary modules, e.g., cache
  providers: [
    TimeParserService,
    // LocalizationService,
    // TimeParserConfigService,
  ],
  exports: [TimeParserService, /*LocalizationService,*/ SuggestionModule],
})
export class TimeParserModule {}
