import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { OidcStrategy } from '../strategies/oidc.strategy';
import { IdentityProvider } from '@prisma/client';

@Injectable()
export class OidcStrategyFactory {
  constructor(
    // private providerService: OidcProviderService,
    private authService: AuthService,
  ) {}

  createStrategy(provider: IdentityProvider): OidcStrategy {
    return new OidcStrategy(this.authService, provider);
  }
}
