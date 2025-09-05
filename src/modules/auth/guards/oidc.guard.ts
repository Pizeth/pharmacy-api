import {
  Injectable,
  ExecutionContext,
  HttpStatus,
  Logger,
  CanActivate,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AppError } from 'src/exceptions/app.exception';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';

@Injectable()
export class DynamicOidcGuard extends AuthGuard('dynamic-oidc') {
  constructor() {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = this.getRequest(context);
    return {
      provider: request.oidcProvider,
    };
  }

  getRequest(context: ExecutionContext) {
    // const request = super.getRequest<Request>(context);
    const request = context.switchToHttp().getRequest<Request>();
    const provider = request.params.provider;

    // Store provider name to be used in strategy
    request.oidcProvider = provider;
    return request;
  }
}

@Injectable()
export class DynamicOidcAuthGuard implements CanActivate {
  private readonly context = DynamicOidcAuthGuard.name;
  private readonly logger = new Logger(this.context);

  constructor(private readonly oidcProviderService: OidcProviderService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const providerName = request.params.provider;

    // 1. Validate that a strategy for this provider exists and is enabled.
    const strategy = this.oidcProviderService.getStrategy(providerName);
    if (!strategy) {
      throw new AppError(
        `OIDC provider '${providerName}' not found or is disabled.`,
        HttpStatus.BAD_REQUEST,
        this.context,
        `Provider ${providerName} not found or is disabled.`,
      );
    }

    // 2. Dynamically create an AuthGuard instance with the correct strategy name.
    // The `AuthGuard` function is a mixin that returns a class.
    const guard = new (AuthGuard(providerName))();

    // 3. Delegate the canActivate check to the newly created guard instance.
    // This will trigger the correct Passport strategy.
    const result = await guard.canActivate(context);
    return result as boolean;
  }
}
