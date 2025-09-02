import { Module } from '@nestjs/common';
import { CacheModule } from 'src/modules/cache/cache.module';
import { LevenshteinService } from './levenshtein.service';
import { ConfigModule } from '@nestjs/config';
import suggestionConfig from '../../configs/suggestion.config';

@Module({
  imports: [ConfigModule.forFeature(suggestionConfig), CacheModule],
  providers: [LevenshteinService],
  exports: [LevenshteinService, CacheModule],
})
export class LevenshteinModule {}
