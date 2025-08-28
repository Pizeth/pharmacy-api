import { Profile, StrategyOptions } from 'passport-openidconnect';

export interface OIDCProviderConfig extends StrategyOptions {
  // provider: string;
  name: string;
  // displayName: string;
  enabled: boolean;
}

export interface NormalizedProfile {
  id: string;
  providerId: number;
  provider: string;
  displayName?: string;
  username?: string;
  name?: string;
  email: string;
  emailVerified: boolean;
  photo?: string;
  raw: Profile;
}
