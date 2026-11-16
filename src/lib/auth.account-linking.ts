import type { BetterAuthOptions } from 'better-auth';

// Telegram proves ownership of its OIDC subject without supplying an email.
// Require an explicit signed-in linking flow for every provider.
export const accountLinking = {
  disableImplicitLinking: true,
  allowDifferentEmails: true,
  trustedProviders: ['telegram'],
} satisfies NonNullable<
  NonNullable<BetterAuthOptions['account']>['accountLinking']
>;
