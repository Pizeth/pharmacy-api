import { GenericOAuthConfig } from 'better-auth/plugins';

/**
 * 1. Declare core Social Providers in a strict constant object.
 * TypeScript will automatically read all keys added here.
 */
export const getSocialProvidersConfig = () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID as string,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
  },
  // ⚡ If you add "apple" or "microsoft" here later, the types and endpoints update automatically!
});

/**
 * 2. Declare Generic OAuth Providers in a strict constant array.
 * TypeScript will automatically extract the literal 'providerId' string values.
 */
export const getGenericProvidersConfig = (): GenericOAuthConfig[] => [
  {
    // Enforces that this string matches your type union
    providerId: 'telegram',
    clientId: process.env.TELEGRAM_CLIENT_ID as string,
    clientSecret: process.env.TELEGRAM_CLIENT_SECRET,
    discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL,
  },
  // ⚡ If you append a new generic provider here, the type auto-updates instantly!
];
