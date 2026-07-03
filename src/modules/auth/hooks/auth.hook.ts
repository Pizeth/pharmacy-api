import { Injectable } from '@nestjs/common';
import {
  Hook,
  BeforeHook,
  AuthHookContext,
  AfterHook,
} from '@thallesp/nestjs-better-auth';
import { AuthService } from '../services/auth.service';
// import { AuthService } from './auth.service';

type HookContext = AuthHookContext & {
  context: {
    session?: {
      userId?: string | number;
    };
    newSession?: {
      userId?: string | number;
    };
  };
};

@Hook()
@Injectable()
export class AuthHooks {
  constructor(private readonly authService: AuthService) {}

  @BeforeHook('/sign-in/email')
  async beforeEmailSignIn(ctx: AuthHookContext) {
    const request = ctx.request;
    if (!request) return;

    // const body = (await request.json()) as { email?: string };
    // const body = (await request.clone().json()) as { email?: string }; // 👈 clone
    // if (!body.email) return;
    // 👇 Use ctx.body instead of ctx.request.json()
    const body = ctx.body as { email?: string } | undefined;
    if (!body?.email) return;

    // if (body.email) {
    const user = await this.authService.getUserByIdentifier(body.email);
    if (user) {
      // Email/password users must be fully activated
      await this.authService.assertUserCanLogin(user.id);
    }
    // }
  }

  @BeforeHook('/sign-in/username')
  async beforeUsernameSignIn(ctx: AuthHookContext) {
    const request = ctx.request;
    if (!request) return;

    console.log('ctx keys:', Object.keys(ctx));
    console.log('ctx.body:', (ctx as any).body);
    console.log('ctx.context:', Object.keys((ctx as any).context ?? {}));
    // const body = (await request.json()) as { username?: string };
    // 👇 Clone before reading — body stream can only be consumed once
    // const body = (await request.clone().json()) as { username?: string };
    // 👇 Use ctx.body instead of ctx.request.json()
    const body = ctx.body as { username?: string } | undefined;
    if (!body?.username) return;

    // if (body.username) {
    const user = await this.authService.getUserByIdentifier(body.username);
    if (user) {
      // Username/password users must be fully activated
      await this.authService.assertUserCanLogin(user.id);
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
