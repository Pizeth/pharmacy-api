export interface OIDCProviderConfig {
  // provider: string;
  name: string;
  // displayName: string;
  issuer: string;
  authorizationURL: string;
  tokenURL: string;
  callbackURL: string;
  userInfoURL: string;
  clientID: string;
  clientSecret: string;
  scope?: string | string[] | undefined;
  enabled: boolean;
}

export interface NormalizedProfile {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}
