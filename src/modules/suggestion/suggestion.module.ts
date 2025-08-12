import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache/cache.module';
import suggestionConfig from './config/suggestion.config';
import { LevenshteinService } from './services/levenshtein/levenshtein.service';
import { SuggestionService } from './services/suggestion.service';
import { BKTreeService } from './services/bk-tree/bk-tree.service';
import { TrieService } from './services/trie/trie.service';
import { TrigramIndexService } from './services/trigram/trigram-index.service';

@Module({
  imports: [CacheModule, ConfigModule.forFeature(suggestionConfig)],
  providers: [
    SuggestionService,
    BKTreeService,
    TrigramIndexService,
    TrieService,
    LevenshteinService,
  ],
  exports: [SuggestionService, CacheModule],
})
export class SuggestionModule {}
