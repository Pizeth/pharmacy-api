import { registerAs } from '@nestjs/config';
import { OIDCProviderConfig } from '../interfaces/oidc.interface';

export default registerAs('oidc-provider', (): OIDCProviderConfig[] => {
  const providers: OIDCProviderConfig[] = [
    {
      name: 'google', // This will be used in the URL: /auth/google
      issuer: 'https://accounts.google.com',
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://oauth2.googleapis.com/token',
      userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: 'http://localhost:3000/auth/google/callback',
      scope: 'openid email profile',
      enabled: true,
    },
    {
      name: 'microsoft', // This will be used in the URL: /auth/microsoft
      issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`,
      authorizationURL: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
      userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
      clientID: process.env.MS_CLIENT_ID ?? '',
      clientSecret: process.env.MS_CLIENT_SECRET ?? '',
      callbackURL: 'http://localhost:3000/auth/microsoft/callback',
      scope: 'openid email profile',
      enabled: false,
    },
    // Add other providers like Apple, Facebook, etc. here
  ];
  // Return only the providers that are explicitly enabled
  return providers.filter((p) => p.enabled);
});

export const oidcProviderConfigs: OIDCProviderConfig[] = [
  {
    name: 'google', // This will be used in the URL: /auth/google
    issuer: 'https://accounts.google.com',
    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: 'https://oauth2.googleapis.com/token',
    userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientID: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackURL: 'http://localhost:3000/auth/google/callback',
    scope: 'openid email profile',
    enabled: true,
  },
  {
    name: 'microsoft', // This will be used in the URL: /auth/microsoft
    issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`,
    authorizationURL: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/authorize`,
    tokenURL: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
    userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
    clientID: process.env.MS_CLIENT_ID ?? '',
    clientSecret: process.env.MS_CLIENT_SECRET ?? '',
    callbackURL: 'http://localhost:3000/auth/microsoft/callback',
    scope: 'openid email profile',
    enabled: false,
  },
  // Add other providers like Apple, Facebook, etc. here
];
