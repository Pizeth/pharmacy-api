import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
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
import { PrismaClient } from 'generated/prisma/client';
// Factory function so we can inject our existing PrismaService
export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    appName: 'Razeth',
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    advanced: {
      database: {
        generateId: 'serial',
      },
      cookiePrefix: 'razeth',
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
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      facebook: {
        clientId: process.env.FACEBOOK_CLIENT_ID!,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      },
      // apple: {
      //   clientId: process.env.APPLE_CLIENT_ID!,
      //   clientSecret: process.env.APPLE_CLIENT_SECRET!,
      // },
    },
    user: {
      additionalFields: {
        // Role relation — CASL reads this to load permissions
        roleId: {
          type: 'number',
          required: false, // false so social sign-up doesn't break
          input: false, // never set by the client
        },
        // Security flags not covered by admin() plugin
        isEnabled: {
          type: 'boolean',
          required: false,
          defaultValue: true,
          input: false,
        },
        isLocked: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
        isActivated: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
        // Soft delete
        deletedAt: {
          type: 'string', // Better Auth has no "date" type, use string for ISO date
          required: false,
          input: false,
        },
        // Audit tracking
        createdBy: {
          type: 'number',
          required: false,
          input: false,
        },
        lastUpdatedBy: {
          type: 'number',
          required: false,
          input: false,
        },
        objectVersionId: {
          type: 'number',
          required: false,
          defaultValue: 1,
          input: false,
        },
      },
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
        provider: 'cloudflare-turnstile', // or google-recaptcha, hcaptcha, captchafox
        secretKey: process.env.TURNSTILE_SECRET_KEY!,
      }),
      magicLink({
        sendMagicLink: async ({ email, token, url, metadata }, ctx) => {
          // send email to user
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (type === 'sign-in') {
            // Send the OTP for sign in
          } else if (type === 'email-verification') {
            // Send the OTP for email verification
          } else {
            // Send the OTP for password reset
          }
        },
      }),
      phoneNumber({
        sendOTP: ({ phoneNumber, code }, ctx) => {
          // Implement sending OTP code via SMS
        },
      }),
      genericOAuth({
        config: [
          {
            providerId: 'telegram',
            clientId: process.env.TELEGRAM_CLIENT_ID!,
            clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
            discoveryUrl: process.env.TELEGRAM_DISCOVERY_URL!,
            // ... other config options
          },
          // Add more providers as needed
        ],
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
}

// Type export for convenience
export type Auth = ReturnType<typeof createAuth>;
