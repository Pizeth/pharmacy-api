// import { createAuth } from 'lib/auth';
// import { BetterAuthOptions } from 'better-auth';
// import { GenericOAuthConfig } from 'better-auth/plugins';

import {
  ACTIVE_BASE_PROVIDERS,
  SOCIAL_PROVIDERS_CONFIG,
  GENERIC_PROVIDERS_CONFIG_RAW,
} from 'lib/auth.provider';

// Type export for convenience
// export type Auth = ReturnType<typeof createAuth>;

// // 💡 Define exact provider strings here using a standard string literal union
// const GENERIC_PROVIDER_IDS = ['telegram'] as const;
// type ActiveGenerics = (typeof GENERIC_PROVIDER_IDS)[number]; // "telegram"

// /**
//  * 1. Declare core Social Providers in a strict constant object.
//  * TypeScript will automatically read all keys added here.
//  */
// export const SOCIAL_PROVIDERS_CONFIG = {
//   google: {
//     clientId: process.env.GOOGLE_CLIENT_ID!,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//   },
//   facebook: {
//     clientId: process.env.FACEBOOK_CLIENT_ID!,
//     clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
//   },
//   // ⚡ If you add "apple" or "microsoft" here later, the types and endpoints update automatically!
// };

// /**
//  * 2. Declare Generic OAuth Providers in a strict constant array.
//  * TypeScript will automatically extract the literal 'providerId' string values.
//  */
// export const GENERIC_PROVIDERS_CONFIG: GenericOAuthConfig[] = [
//   {
//     // Enforces that this string matches your type union
//     providerId: 'telegram' satisfies ActiveGenerics,
//     clientId: process.env.TELEGRAM_CLIENT_ID!,
//     clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
//     discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
//   },
//   // ⚡ If you append a new generic provider here, the type auto-updates instantly!
// ];

// /**
//  * 2. Declare Generic OAuth Providers in a strict constant array.
//  * TypeScript will automatically extract the literal 'providerId' string values.
//  */
// export const GENERIC_PROVIDERS_CONFIG = [
//   {
//     providerId: 'telegram',
//     clientId: process.env.TELEGRAM_CLIENT_ID!,
//     clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
//     discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
//   },
//   // ⚡ If you append a new generic provider here, the type auto-updates instantly!
// ] as const;

// // 3. Define the static base strategies your app supports
// export const ACTIVE_BASE_PROVIDERS = [
//   'credential',
//   'magic-link',
//   'passkey',
// ] as const;

// // 💡 Auto-extracts the keys directly from the objects above
// export const ACTIVE_SOCIAL_PROVIDERS = Object.keys(
//   SOCIAL_PROVIDERS_CONFIG,
// ) as Array<keyof typeof SOCIAL_PROVIDERS_CONFIG>;
// export const ACTIVE_GENERIC_PROVIDERS = GENERIC_PROVIDERS_CONFIG.map(
//   (p) => p.providerId,
// );

// ⚡ 100% Automated Pure type union for backend data validation.
type ActiveBaseProviders = (typeof ACTIVE_BASE_PROVIDERS)[number];
type ActiveSocials = keyof typeof SOCIAL_PROVIDERS_CONFIG; // "google" | "facebook"
// Auto-extracts "telegram" from the generic array configuration
type ActiveGenerics =
  (typeof GENERIC_PROVIDERS_CONFIG_RAW)[number]['providerId'];

/**
 *  Zero maintenance required when adding more social or generic providers above!
 */
export type ConfiguredProviderId =
  | ActiveBaseProviders
  | ActiveSocials
  | ActiveGenerics;

// // 1. Explicitly type options-factory function
// export declare const options: (prisma: PrismaClient) => BetterAuthOptions;

// // 2. Infer the exact schema type returned by the function
// // (This ensures plugins, additional fields, and configurations carry over cleanly)
// export type AuthOptions = ReturnType<typeof options>;
