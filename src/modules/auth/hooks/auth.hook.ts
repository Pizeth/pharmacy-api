import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Hook,
  // BeforeHook,
  AuthHookContext,
  AfterHook,
} from '@thallesp/nestjs-better-auth';
import { AuthService } from '../services/auth.service';
import { AppError } from 'exceptions/app.exception';
import { APIError } from 'better-auth/api';
import { Status } from 'better-auth';
// import { AuthService } from './auth.service';

type HookContext = AuthHookContext & {
  context: {
    session?: { userId?: number };
    newSession?: { userId?: number };
  };
};

@Hook()
@Injectable()
export class AuthHooks {
  constructor(private readonly authService: AuthService) {}

  // ── Email Sign-In (After Password Verification) ──────────────────────────
  @AfterHook('/sign-in/email')
  async beforeEmailSignIn(ctx: HookContext) {
    // 👇 Use ctx.body instead of ctx.request.json()
    // const body = ctx.body as { email?: string } | undefined;
    // if (!body?.email) return;

    const userId =
      ctx.context?.session?.userId ?? ctx.context?.newSession?.userId;
    if (!userId) return;

    // const user = await this.authService.getUserByIdentifier(body.email);
    // if (user) {
    // Email/password users must be fully activated
    try {
      await this.authService.assertUserCanLogin(userId);
    } catch (e) {
      const httpStatus = (
        e instanceof AppError ? e.statusCode : HttpStatus.FORBIDDEN
      ) as Status;
      const message =
        e instanceof AppError ? e.message : 'Account is not activated';
      // 👈 Safely pass the error to Better Auth's lifecycle handler
      throw new APIError(httpStatus, { message });
    }
    // }
  }

  // ── Username Sign-In (After Password Verification) ───────────────────────
  @AfterHook('/sign-in/username')
  async beforeUsernameSignIn(ctx: HookContext) {
    // 👇 Use ctx.body instead of ctx.request.json()
    // const body = ctx.body as { username?: string } | undefined;
    // if (!body?.username) return;

    const userId =
      ctx.context?.session?.userId ?? ctx.context?.newSession?.userId;
    if (!userId) return;

    // const user = await this.authService.getUserByIdentifier(body.username);
    // if (user) {
    // Username/password users must be fully activated
    try {
      await this.authService.assertUserCanLogin(userId);
    } catch (e) {
      const httpStatus = (
        e instanceof AppError ? e.statusCode : HttpStatus.FORBIDDEN
      ) as Status;
      const message =
        e instanceof AppError ? e.message : 'Account is not activated';
      // 👈 Safely pass the error to Better Auth's lifecycle handler
      throw new APIError(httpStatus, { message });
    }
    // }
  }

  // 👇 Add this — social sign-ins skip isActivated check
  // @BeforeHook('/sign-in/social')
  // async beforeSocialSignIn(ctx: AuthHookContext) {
  //   const request = ctx.request;
  //   if (!request) return;
  //   // const body = (await ctx.request?.json()) as { provider?: string };
  //   const body = (await request.json()) as { email?: string };
  //   // Only check enabled/locked/banned — NOT isActivated
  //   // since Google already verified the identity
  //   // Social sign-in body may not have email at this stage —
  //   // Better Auth resolves the email after the OAuth callback.
  //   // We can only check by email if it's present (e.g. on re-login).
  //   if (!body.email) return;

  //   const user = await this.authService.getUserByIdentifier(body.email);
  //   if (user) {
  //     // Skip activation check — Google/social provider already verified identity
  //     await this.authService.assertUserCanLogin(user.id, {
  //       checkActivation: false,
  //     });
  //   }
  // }

  // ── Social Callbacks ──────────────────────────────────────────────────────
  // Runs AFTER Google/social resolves the user — this is where
  // we actually know who the user is for social sign-ins
  @AfterHook('/callback/:provider')
  async afterSocialCallback(ctx: HookContext) {
    console.log(Object.keys(ctx.context ?? {}));
    // The session is populated after a successful OAuth callback
    const userId =
      ctx.context?.session?.userId ?? ctx.context?.newSession?.userId;

    if (!userId) return;

    await this.authService.assertUserCanLogin(Number(userId), {
      checkActivation: false, // social provider already verified identity
    });
  }

  // Also cover the generic OAuth callback path used by genericOAuth plugin
  @AfterHook('/oauth2/callback/:provider')
  async afterGenericOAuthCallback(ctx: HookContext) {
    const userId =
      ctx.context?.session?.userId ?? ctx.context?.newSession?.userId;

    if (!userId) return;

    await this.authService.assertUserCanLogin(Number(userId), {
      checkActivation: false,
    });
  }
}
