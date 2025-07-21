/* eslint-disable @typescript-eslint/no-empty-object-type */
import { CacheOptions } from '../interfaces/caches';
import { CacheService } from './cache.service';

export class SessionCacheService extends CacheService {
  constructor(config?: CacheOptions<string, unknown>) {
    super({
      max: 5000,
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      useLibrary: true,
      backgroundPruneInterval: 5 * 60 * 1000, // Prune every 5 minutes
      ...config,
    });
  }

  public setSession<TSession extends {}>(
    sessionId: string,
    sessionData: TSession,
    ttl: number = 30 * 60 * 1000,
  ): void {
    this.set('sessions', `session:${sessionId}`, sessionData, { ttl });
  }

  public getSession<TSession extends {}>(
    sessionId: string,
  ): TSession | undefined {
    return this.get<TSession>('sessions', `session:${sessionId}`);
  }

  public refreshSession<TSession extends {}>(
    sessionId: string,
    ttl: number = 30 * 60 * 1000,
  ): TSession | undefined {
    return this.getAndRefresh<TSession>(
      'sessions',
      `session:${sessionId}`,
      ttl,
    );
  }

  public removeSession(sessionId: string): boolean {
    return this.delete('sessions', `session:${sessionId}`);
  }
}
