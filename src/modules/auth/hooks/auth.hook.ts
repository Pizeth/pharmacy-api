import { Injectable } from '@nestjs/common';
import {
  Hook,
  BeforeHook,
  AuthHookContext,
} from '@thallesp/nestjs-better-auth';
import { AuthService } from '../services/auth.service';
// import { AuthService } from './auth.service';

@Hook()
@Injectable()
export class AuthHooks {
  constructor(private readonly authService: AuthService) {}

  @BeforeHook('/sign-in/email')
  async beforeEmailSignIn(ctx: AuthHookContext) {
    const request = ctx.request;
    if (!request) return;

    const body = (await request.json()) as { email?: string };
    if (body.email) {
      const user = await this.authService.getUserByIdentifier(body.email);
      if (user) {
        await this.authService.assertUserCanLogin(user.id);
      }
    }
  }

  @BeforeHook('/sign-in/username')
  async beforeUsernameSignIn(ctx: AuthHookContext) {
    const request = ctx.request;
    if (!request) return;

    const body = (await request.json()) as { username?: string };
    if (body.username) {
      const user = await this.authService.getUserByIdentifier(body.username);
      if (user) {
        await this.authService.assertUserCanLogin(user.id);
      }
    }
  }
}
