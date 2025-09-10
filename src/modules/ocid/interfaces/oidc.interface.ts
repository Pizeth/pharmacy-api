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

export interface OpenIDProfile {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  [key: string]: any;
}

export interface OpenIDTokens {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_at?: number;
  scope?: string;
}

export interface OpenIDStrategyOptions {
  issuer: URL;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope?: string[];
  responseType?: string;
  responseMode?: string;
  prompt?: string;
  // from qwen
  passReqToCallback?: boolean;
  state?: boolean;
  nonce?: boolean;
}

// Extend Profile interface to include OpenID Connect specific fields
export interface OpenIDConnectProfile extends Profile {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  idTokenClaims?: Record<string, any>;
}

// Strategy options interface
export interface OpenIDConnectStrategyOptions {
  clientID: string;
  clientSecret: string;
  issuer: string;
  callbackURL: string;
  scope?: string[];
  passReqToCallback?: boolean;
  state?: boolean;
  nonce?: boolean;
  responseMode?: string;
}

// Strategy state storage interface
interface StrategyState {
  state?: string;
  nonce?: string;
  providerName: string;
}
