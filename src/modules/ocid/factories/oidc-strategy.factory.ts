import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { OidcStrategy } from '../../auth/strategies/oidc.strategy';
import { IdentityProvider } from '@prisma/client';
import { OidcProviderService } from '../services/oidc-provider.service';

@Injectable()
export class OidcStrategyFactory {
  constructor(
    private readonly providerService: OidcProviderService,
    private readonly authService: AuthService,
  ) {}

  createStrategy(provider: IdentityProvider): OidcStrategy {
    return new OidcStrategy(this.authService, this.providerService, provider);
  }
}

@Injectable()
export class OidcStrategyFactoryGPT {
  createStrategy(provider: IdentityProvider): OidcStrategy {
    // create OidcStrategy instance with provider runtime values
    return new OidcStrategy(provider);
  }
}
