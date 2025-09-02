import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { CacheModule } from '../cache/cache.module';
import suggestionConfig from './configs/suggestion.config';
// import { LevenshteinService } from './services/levenshtein/levenshtein.service';
import { SuggestionService } from './services/suggestion.service';
import { BKTreeService } from './services/bk-tree/bk-tree.service';
import { TrieService } from './services/trie/trie.service';
import { TrigramIndexService } from './services/trigram/trigram-index.service';
import { LevenshteinModule } from './services/levenshtein/levenshtein.module';

@Module({
  imports: [ConfigModule.forFeature(suggestionConfig), LevenshteinModule],
  providers: [
    BKTreeService,
    TrigramIndexService,
    TrieService,
    SuggestionService,
    // LevenshteinService,
  ],
  exports: [SuggestionService, LevenshteinModule],
})
export class SuggestionModule {}
