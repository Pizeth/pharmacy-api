import { passkey } from '@better-auth/passkey';
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
} from 'better-auth/plugins';
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
    plugins: [
      admin(),
      username({ minUsernameLength: 3, maxUsernameLength: 50 }),
      twoFactor(),
      passkey(),
      jwt(),
      bearer(),
      haveIBeenPwned(),
      lastLoginMethod({ storeInDatabase: true }),
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
