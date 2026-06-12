import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Auth } from 'lib/auth';
import { ACTIVE_SOCIAL_PROVIDERS, ACTIVE_GENERIC_PROVIDERS } from 'types/auth';
// import { Auth } from 'lib/auth';
// import { Auth } from '../auth';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  // Better Auth handles all of these automatically — no need to define them:
  // POST /api/auth/sign-in/email
  // POST /api/auth/sign-in/username
  // POST /api/auth/sign-up/email
  // POST /api/auth/sign-out
  // GET  /api/auth/sign-in/:provider  (social)
  // GET  /api/auth/callback/:provider
  // POST /api/auth/forget-password
  // POST /api/auth/reset-password
  // POST /api/auth/verify-email
  // ... and everything else from your plugins

  @Get('me')
  getMe(@Session() session: UserSession<Auth>) {
    return session.user;
  }

  @Get('providers')
  getEnabledProviders() {
    return {
      // Direct list of what you initialized in your createAuth() factory
      // Send active OAuth targets so Next.js can map buttons dynamically
      social: ACTIVE_SOCIAL_PROVIDERS,
      generic: ACTIVE_GENERIC_PROVIDERS,
    };
  }
}
