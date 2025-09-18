import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  UseGuards,
  CanActivate,
} from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
// import { OidcStrategy, OidcAuthenticateOptions } from './oidc-strategy';

/**
 * A wrapper guard that can work with dynamically created OIDC strategies
 * This bypasses the normal Passport strategy registration process
 */
@Injectable()
export class OidcGuard implements CanActivate {
  private strategy: Strategy;

  constructor(strategy: Strategy) {
    this.strategy = strategy;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return new Promise<boolean>((resolve, reject) => {
      // Create a mock strategy context that provides the necessary methods
      const strategyContext = {
        success: (user: OidcUser, info?: unknown) => {
          request.user = user;
          resolve(true);
        },
        fail: (challenge?: Error, status?: number) => {
          reject(
            new UnauthorizedException(
              challenge?.message || 'Authentication failed',
            ),
          );
        },
        redirect: (url: string, status?: number) => {
          response.redirect(status || 302, url);
          resolve(false); // Don't continue processing
        },
        pass: () => {
          resolve(true);
        },
        error: (err: Error) => {
          reject(err);
        },
      };

      // Bind the strategy methods to our context
      Object.setPrototypeOf(this.strategy, strategyContext);

      // Extract options from request or use defaults
      const options: AuthenticateOptions = this.getAuthenticateOptions(context);

      // Call the strategy's authenticate method
      this.strategy.authenticate(request, options);
    });
  }

  protected getAuthenticateOptions(
    context: ExecutionContext,
  ): AuthenticateOptions {
    const request = context.switchToHttp().getRequest<Request>();

    // You can extract options from query parameters, headers, or route parameters
    const options: AuthenticateOptions = {};

    // Extract scope from query parameters
    if (request.query.scope) {
      options.scope = Array.isArray(request.query.scope)
        ? (request.query.scope as string[])
        : (request.query.scope as string).split(' ');
    }

    // Extract other parameters
    if (request.query.prompt) {
      options.prompt = request.query.prompt as string;
    }

    if (request.query.login_hint) {
      options.loginHint = request.query.login_hint as string;
    }

    return options;
  }
}

/**
 * Factory function to create OIDC guards with specific strategies
 */
export function createOidcGuard(strategy: Strategy): new () => OidcGuard {
  @Injectable()
  class DynamicOidcGuard extends OidcGuard {
    constructor() {
      super(strategy);
    }
  }
  return DynamicOidcGuard;
}

/**
 * Decorator to create and apply OIDC authentication
 */
export function UseOidcAuth(strategy: Strategy) {
  const GuardClass = createOidcGuard(strategy);
  return UseGuards(GuardClass);
}

// Alternative approach: Direct authentication without guards
import { createParamDecorator, SetMetadata } from '@nestjs/common';

export const OIDC_STRATEGY_KEY = 'oidc_strategy';

/**
 * Decorator to set the OIDC strategy for a route
 */
export const OidcAuth = (strategy: Strategy) =>
  SetMetadata(OIDC_STRATEGY_KEY, strategy);

/**
 * Parameter decorator to get the authenticated user
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);

/**
 * Interceptor-based approach for OIDC authentication
 */
import { NestInterceptor, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Strategy } from 'src/modules/ocid/strategies/openid-client.strategy';
import {
  AuthenticateOptions,
  OidcUser,
} from 'src/modules/ocid/interfaces/oidc.interface';

@Injectable()
export class OidcInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const strategy = this.reflector.get<Strategy>(
      OIDC_STRATEGY_KEY,
      context.getHandler(),
    );

    if (!strategy) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // If user is already authenticated, continue
    if (request.user) {
      return next.handle();
    }

    return new Promise((resolve, reject) => {
      const strategyContext = {
        success: (user: OidcUser) => {
          request.user = user;
          resolve(next.handle());
        },
        fail: (challenge?: Error) => {
          reject(
            new UnauthorizedException(
              challenge?.message || 'Authentication failed',
            ),
          );
        },
        redirect: (url: string, status?: number) => {
          response.redirect(status || 302, url);
          resolve(new Observable((subscriber) => subscriber.complete()));
        },
        pass: () => {
          resolve(next.handle());
        },
        error: (err: Error) => {
          reject(err);
        },
      };

      Object.setPrototypeOf(strategy, strategyContext);
      strategy.authenticate(request, {});
    });
  }
}
