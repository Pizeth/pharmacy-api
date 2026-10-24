import { jest } from '@jest/globals';
import { LocalizationService } from './localization.service';
import { CacheService } from 'modules/cache/services/cache.service';
import timeParserConfig from '../../configs/time-parser.config';

describe('LocalizationService', () => {
  it('returns the configured default localization from the cache', () => {
    const config = timeParserConfig();
    const cache = Object.create(CacheService.prototype) as CacheService;
    const set = jest.spyOn(cache, 'set').mockImplementation(() => {});
    jest.spyOn(cache, 'has').mockReturnValue(false);

    const service = new LocalizationService(
      config.localesPath,
      config.localizationConfig,
      config.maxCacheSize,
      cache,
    );

    expect(service).toBeDefined();
    expect(set).toHaveBeenCalledWith(
      'LOCALIZATION_CACHE',
      config.localizationConfig.locale,
      config.localizationConfig,
    );
    expect(service.get('nonexistent-locale')).toEqual(
      config.localizationConfig,
    );
  });
});
