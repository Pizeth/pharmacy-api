import { Injectable, Logger } from '@nestjs/common';
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

// CORRECTED: Import the entire module to access its functions, like 'discovery'.
import * as oidc from 'openid-client';
// CORRECTED: Import 'Configuration' as a type for annotations.
import type { Configuration } from 'openid-client';

@Injectable()
export class OidcStrategyFactory {
  private readonly logger = new Logger(OidcStrategyFactory.name);

  // constructor(private readonly authService: AuthService) {}

  async createStrategy(provider: IdentityProvider): Promise<OidcStrategy> {
    try {
      this.logger.log(`Attempting to discover OIDC provider: ${provider.name}`);

      // CORRECTED: Use the modern `oidc.discovery` function.
      // It takes the issuer URL, client ID, and the client secret directly.
      const config: Configuration = await oidc.discovery(
        new URL(provider.issuer),
        provider.clientID,
        provider.clientSecret, // The metadata parameter accepts the secret as a string
      );

      this.logger.log(
        `Successfully discovered and configured provider: ${provider.name}`,
      );

      // CORRECTED: Pass the new `Configuration` object to the strategy.
      return new OidcStrategy(config);
    } catch (error) {
      this.logger.error(
        `Failed to create OIDC strategy for provider '${provider.name}'`,
        error,
      );
      throw error;
    }
  }
}
