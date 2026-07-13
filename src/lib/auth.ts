import { betterAuth, isProduction } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from 'generated/prisma/client';
// 🚀 Pull the providers dynamically using local relative step-ups
// import { GENERIC_PROVIDERS_CONFIG, SOCIAL_PROVIDERS_CONFIG } from 'types/auth';
import {
  username,
  magicLink,
  twoFactor,
  bearer,
  haveIBeenPwned,
  lastLoginMethod,
  jwt,
  admin,
  phoneNumber,
  emailOTP,
  oneTap,
  genericOAuth,
  multiSession,
  captcha,
} from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { apiKey } from '@better-auth/api-key';
import { i18n } from '@better-auth/i18n';
import {
  getSocialProvidersConfig,
  getGenericProvidersConfig,
} from './auth.provider';

export const options = (prisma: PrismaClient) => ({
  appName: 'Razeth',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  trustedOrigins: [
    // process.env.FRONTEND_URL || 'http://localhost:8080', // Next.js prod
    // process.env.BETTER_AUTH_URL || 'http://localhost:3000', // NestJS prod
    // 'http://localhost:8080', // 👈 explicitly add for dev
    ...(process.env.FRONTEND_URL || 'http://localhost:8080').split(','),
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  ],
  // FIX: Explicitly initialize the hooks block so the NestJS module can attach to it
  hooks: {},
  advanced: {
    database: {
      generateId: 'serial' as const, // 👈 Prevent string-widening
    },
    cookiePrefix: 'razeth',
    // useSecureCookies: isProduction, // 👈 Better Auth's built-in toggle
    // crossSubdomainCookies: {
    //   enabled: false, // same domain in dev, enable in prod if needed
    // },
    crossSubdomainCookies: {
      enabled: true, // 👈 enable cross-subdomain cookies
      domain: isProduction ? '.razeth.com' : undefined, // 👈 leading dot = all subdomains
    },
    cookies: {
      session_token: {
        attributes: {
          sameSite: 'lax' as const,
          secure: isProduction, // 👈 false for http localhost
          httpOnly: true,
        },
      },
      state_cookie: {
        attributes: {
          sameSite: isProduction ? ('none' as const) : ('lax' as const), // 👈 required for cross-origin OAuth redirect
          secure: isProduction, // 👈 false for http localhost
          httpOnly: true,
        },
      },
    },
  },
  // Mirror the same plugins/options as your real auth config
  // so the CLI generates the correct schema
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // onExistingUserSignUp: async ({ user }, request) => {
    //   // Notify the existing user about the sign-up attempt
    //   console.log(`Someone tried to sign up with ${user.email}`);
    // },
    // sendResetPassword: async ({ user, url, token }, request) => {
    //   void sendEmail({
    //     to: user.email,
    //     subject: 'Reset your password',
    //     text: `Click the link to reset your password: ${url}`,
    //   });
    // },
  },
  socialProviders: getSocialProvidersConfig(),
  user: {
    additionalFields: {
      // Role relation — CASL reads this to load permissions
      roleId: {
        type: 'number' as const, // 👈 Force exact literal mapping
        required: false, // false so social sign-up doesn't break
        input: false, // never set by the client
      },
      // Security flags not covered by admin() plugin
      mustChangePassword: {
        type: 'boolean' as const,
        required: false,
        defaultValue: false,
        input: false,
      },
      isEnabled: {
        type: 'boolean' as const,
        required: false,
        defaultValue: true,
        input: false,
      },
      isLocked: {
        type: 'boolean' as const,
        required: false,
        defaultValue: false,
        input: false,
      },
      isActivated: {
        type: 'boolean' as const,
        required: false,
        defaultValue: false,
        input: false,
      },
      // Soft delete
      deletedAt: {
        type: 'string' as const, // Better Auth has no "date" type, use string for ISO date
        required: false,
        input: false,
      },
      // Audit tracking
      createdBy: {
        type: 'number' as const,
        required: false,
        input: false,
      },
      lastUpdatedBy: {
        type: 'number' as const,
        required: false,
        input: false,
      },
      objectVersionId: {
        type: 'number' as const,
        required: false,
        defaultValue: 1,
        input: false,
      },
    },
  },
  account: {
    skipStateCookieCheck: process.env.NODE_ENV !== 'production',
  },
  plugins: [
    apiKey(),
    // admin() kept ONLY for utilities: ban user, list users, impersonate
    // Its `role` string field on User is ignored — CASL handles authorization
    admin(),
    username({ minUsernameLength: 3, maxUsernameLength: 50 }),
    oneTap(),
    twoFactor(),
    passkey(),
    jwt(),
    bearer(),
    haveIBeenPwned(),
    lastLoginMethod({ storeInDatabase: true }),
    multiSession(),
    captcha({
      provider: 'cloudflare-turnstile' as const, // or google-recaptcha, hcaptcha, captchafox
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
    }),
    magicLink({
      sendMagicLink: async ({ email, token, url, metadata }, ctx) => {
        // send email to user
      },
    }),
    // emailOTP({
    //   async sendVerificationOTP({ email, otp, type }) {
    //     if (type === 'sign-in') {
    //       // Send the OTP for sign in
    //     } else if (type === 'email-verification') {
    //       // Send the OTP for email verification
    //     } else {
    //       // Send the OTP for password reset
    //     }
    //   },
    // }),
    // phoneNumber({
    //   sendOTP: ({ phoneNumber, code }, ctx) => {
    //     // Implement sending OTP code via SMS
    //   },
    // }),
    genericOAuth({
      config: getGenericProvidersConfig(),
      // [
      //   {
      //     providerId: 'telegram',
      //     clientId: process.env.TELEGRAM_CLIENT_ID!,
      //     clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
      //     discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
      //     // ... other config options
      //   },
      //   // Add more providers as needed
      // ],
    }),
    i18n({
      translations: {
        fr: {
          USER_NOT_FOUND: 'Utilisateur non trouvé',
          INVALID_EMAIL_OR_PASSWORD: 'Email ou mot de passe invalide',
          INVALID_PASSWORD: 'Mot de passe invalide',
        },
        de: {
          USER_NOT_FOUND: 'Benutzer nicht gefunden',
          INVALID_EMAIL_OR_PASSWORD: 'Ungültige E-Mail oder Passwort',
          INVALID_PASSWORD: 'Ungültiges Passwort',
        },
      },
    }),
  ],
  emailVerification: {
    // sendVerificationEmail: async ({ user, url, token }, request) => {
    //   void sendEmail({
    //     to: user.email,
    //     subject: 'Verify your email address',
    //     text: `Click the link to verify your email: ${url}`,
    //   });
    // },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  rateLimit: {
    enabled: true,
    window: 10, // time window in seconds
    max: 100, // max requests in the window
  },
});

// Factory function so we can inject our existing PrismaService
export function createAuth(prisma: PrismaClient) {
  return betterAuth({ ...options(prisma) });
}

// 🎯 Safe downward downstream types export for convenience
export type Auth = ReturnType<typeof createAuth>;

// 2. Infer the exact schema type returned by the function
export type AuthOptions = ReturnType<typeof options>;

// // 1. Explicitly type options-factory function
// export declare const options: (prisma: PrismaClient) => BetterAuthOptions;

// // 2. Infer the exact schema type returned by the function
// // (This ensures plugins, additional fields, and configurations carry over cleanly)
// export type AuthOptions = ReturnType<typeof options>;
