import { StrategyOptions } from 'passport-openidconnect';

export interface OIDCProviderConfig extends StrategyOptions {
  // provider: string;
  name: string;
  // displayName: string;
  enabled: boolean;
}

export interface NormalizedProfile {
  provider: string;
  id: string;
  displayName?: string;
  username?: string;
  name?: string;
  email: string;
  emailVerified: boolean;
  photo?: string;
}
