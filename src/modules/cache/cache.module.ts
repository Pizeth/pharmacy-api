import { Module } from '@nestjs/common';
import { PRODUCTS_CACHE, USERS_CACHE } from './tokens/cache.tokens';
import { CacheWrapper } from 'src/types/cache';
import { Product, User } from '@prisma/client';
import { EnhancedCache } from './services/enhanced-cache';

@Module({
  providers: [
    // Provider for the Users Cache
    {
      provide: USERS_CACHE,
      useFactory: (): CacheWrapper<string, User> => {
        return new EnhancedCache<string, User>({
          max: 1000,
          defaultTTL: 60 * 1000, // 1 minute
        });
      },
    },
    // Provider for the Products Cache
    {
      provide: PRODUCTS_CACHE,
      useFactory: (): CacheWrapper<number, Product> => {
        return new EnhancedCache<number, Product>({
          max: 500,
          defaultTTL: 5 * 60 * 1000, // 5 minutes
        });
      },
    },
  ],
  // Export the tokens so other modules can inject them
  exports: [USERS_CACHE, PRODUCTS_CACHE],
})
export class CacheModule {}
