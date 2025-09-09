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
export class DynamicOidcAuthGuardGemini implements CanActivate {
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

@Injectable()
export class DynamicOidcAuthGuardGPT implements CanActivate {
  private readonly logger = new Logger(DynamicOidcAuthGuardGPT.name);

  constructor(private readonly oidcProviderService: OidcProviderService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const providerName = request?.params?.provider;

    if (!providerName) {
      this.logger.warn(`Missing provider param on ${request?.path}`);
      throw new NotFoundException('Provider name is required');
    }

    // Validate provider exists and is enabled
    const strategy = this.oidcProviderService.getStrategy(providerName);
    if (!strategy) {
      const enabled = await this.oidcProviderService.getAllEnabledProviders();
      const names = enabled.map((p) => p.name).join(', ') || '<none>';
      this.logger.warn(
        `OIDC provider '${providerName}' not found. Enabled providers: ${names}`,
      );
      throw new NotFoundException(
        `OIDC provider '${providerName}' not found or disabled.`,
      );
    }

    // Create and delegate to the passport AuthGuard for the discovered strategy.
    // AuthGuard is a mixin factory that returns a guard class for the given strategy name.
    const GuardClass = AuthGuard(providerName);
    const guardInstance = new GuardClass();

    try {
      const result = await guardInstance.canActivate(context);
      // Ensure a boolean is returned to satisfy Nest; AuthGuard can return boolean | Promise<boolean>
      return Boolean(result);
    } catch (error) {
      // Let NestJS handle the error. We log context to make debugging easier.
      this.logger.error(
        `Authentication failed for provider ${providerName} on ${request?.path}`,
        error,
      );
      throw error;
    }
  }
}

/**
 * DynamicOidcAuthGuard - Clean and focused approach
 * - Validates provider exists and is enabled
 * - Delegates authentication to the appropriate Passport strategy
 * - Keeps guard focused on authorization logic only
 */
@Injectable()
export class DynamicOidcAuthGuardClaude implements CanActivate {
  private readonly context = DynamicOidcAuthGuardClaude.name;
  private readonly logger = new Logger(this.context);

  constructor(private readonly oidcProviderService: OidcProviderService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const providerName = request?.params?.provider;
    try {
      if (!providerName) {
        throw new AppError(
          'Provider name is required',
          HttpStatus.BAD_REQUEST,
          this.context,
          'Provider name is required',
        );
      }

      // Validate provider exists and is enabled
      const strategy = this.oidcProviderService.getStrategy(providerName);
      if (!strategy) {
        const enabledProviders =
          await this.oidcProviderService.getAllEnabledProviders();
        const names =
          enabledProviders.map((p) => p.name).join(', ') || '<none>';
        this.logger.warn(
          `OIDC provider '${providerName}' not found. Available providers: ${names}`,
        );

        throw new AppError(
          `OIDC provider '${providerName}' not found or disabled.`,
          HttpStatus.NOT_FOUND,
          this.context,
          `OIDC provider '${providerName}' not found or disabled.`,
        );
      }

      // Create and delegate to the appropriate AuthGuard
      const GuardClass = AuthGuard(providerName);
      const guardInstance = new GuardClass();

      const result = await guardInstance.canActivate(context);
      // Ensure a boolean is returned to satisfy Nest; AuthGuard can return boolean | Promise<boolean>
      return Boolean(result);
    } catch (error) {
      // Let NestJS handle the error. We log context to make debugging easier.
      this.logger.error(
        `Authentication failed for provider ${providerName} on ${request?.path}`,
        error,
      );
      throw error; // Let NestJS handle the error properly
    }
  }
}
