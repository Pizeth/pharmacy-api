import { StrategyOptions } from 'passport-openidconnect';

export interface OIDCProviderConfig extends StrategyOptions {
  // provider: string;
  name: string;
  // displayName: string;
  enabled: boolean;
}

export interface NormalizedProfile {
  provider: string;
  providerId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}
