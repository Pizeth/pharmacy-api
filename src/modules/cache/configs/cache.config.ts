import { registerAs } from '@nestjs/config';
import { CacheOptions } from '../interfaces/caches';

export default registerAs('cache-config', (): CacheOptions<string, unknown> => {
  const config: CacheOptions<string, unknown> = {
    defaultTTL: 3600000, // 1 hour,
    backgroundPruneInterval: 180000, // 1 hour default
    max: 100, // 1 hour default
    useLibrary: true,
  };

  // Return only the providers that are explicitly enabled
  return config;
});
