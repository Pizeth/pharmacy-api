import { GenericOAuthConfig } from 'better-auth/plugins';

/**
 * 1. Declare core Social Providers in a strict constant object.
 * TypeScript will automatically read all keys added here.
 */
export const SOCIAL_PROVIDERS_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID as string,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
  },
  // ⚡ If you add "apple" or "microsoft" here later, the types and endpoints update automatically!
};

/**
 * 2. Declare Generic OAuth Providers in a strict constant array.
 * TypeScript will automatically extract the literal 'providerId' string values.
 */
// export const GENERIC_PROVIDERS_CONFIG: GenericOAuthConfig[] = [
//   {
//     // Enforces that this string matches your type union
//     providerId: 'telegram',
//     clientId: process.env.TELEGRAM_CLIENT_ID as string,
//     clientSecret: process.env.TELEGRAM_CLIENT_SECRET,
//     discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL,
//   },
//   // ⚡ If you append a new generic provider here, the type auto-updates instantly!
// ];

export const GENERIC_PROVIDERS_CONFIG_RAW = [
  {
    providerId: 'telegram',
    clientId: process.env.TELEGRAM_CLIENT_ID!,
    clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
    discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
  },
  // ⚡ If you append a new generic provider here, the type auto-updates instantly!
] as const satisfies readonly GenericOAuthConfig[];

export const GENERIC_PROVIDERS_CONFIG: GenericOAuthConfig[] = [
  ...GENERIC_PROVIDERS_CONFIG_RAW,
];

// 3. Define the static base strategies your app supports
export const ACTIVE_BASE_PROVIDERS = [
  'credential',
  'magic-link',
  'passkey',
] as const;

// 💡 Auto-extracts the keys directly from the objects above
export const ACTIVE_SOCIAL_PROVIDERS = Object.keys(
  SOCIAL_PROVIDERS_CONFIG,
) as Array<keyof typeof SOCIAL_PROVIDERS_CONFIG>;
export const ACTIVE_GENERIC_PROVIDERS = GENERIC_PROVIDERS_CONFIG.map(
  (p) => p.providerId,
);

// Functions for backwards compat with auth.ts imports
export const getSocialProvidersConfig = () => SOCIAL_PROVIDERS_CONFIG;
export const getGenericProvidersConfig = () => GENERIC_PROVIDERS_CONFIG;
