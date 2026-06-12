import { GenericOAuthConfig } from 'better-auth/plugins';

/**
 * 1. Declare core Social Providers in a strict constant object.
 * TypeScript will automatically read all keys added here.
 */
export const SOCIAL_PROVIDERS_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
  },
  // ⚡ If you add "apple" or "microsoft" here later, the types and endpoints update automatically!
};

/**
 * 2. Declare Generic OAuth Providers in a strict constant array.
 * TypeScript will automatically extract the literal 'providerId' string values.
 */
export const GENERIC_PROVIDERS_CONFIG: import('better-auth/plugins').GenericOAuthConfig[] =
  [
    {
      // Enforces that this string matches your type union
      providerId: 'telegram',
      clientId: process.env.TELEGRAM_CLIENT_ID!,
      clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
      discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
    },
    // ⚡ If you append a new generic provider here, the type auto-updates instantly!
  ];
