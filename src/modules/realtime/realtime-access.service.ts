import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Auth } from 'lib/auth';
import { CaslAbilityFactory } from 'modules/authorization/casl/casl-ability.factory';
import { AppAction, AppSubject } from 'modules/authorization/casl/app-ability';

@Injectable()
export class RealtimeAccess {
  constructor(
    private readonly auth: AuthService<Auth>,
    private readonly abilities: CaslAbilityFactory,
  ) {}

  async authenticatedUserId(headers: IncomingHttpHeaders): Promise<number> {
    // Do not reuse request.user, a cookie cache, or the opening handshake's ability.
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
      query: { disableCookieCache: true },
    });
    const id = Number(session?.user.id);
    if (!session || !Number.isSafeInteger(id) || id <= 0)
      throw new UnauthorizedException();
    return id;
  }

  async assertRead(headers: IncomingHttpHeaders): Promise<void> {
    const id = await this.authenticatedUserId(headers);
    const ability = await this.abilities.createForUser(id);
    if (!ability.can(AppAction.Read, AppSubject.TranslationKey))
      throw new ForbiddenException();
  }
}
