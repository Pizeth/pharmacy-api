// src/modules/authorization/guards/policies.guard.ts

import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from 'exceptions/app.exception';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CHECK_POLICIES_KEY } from '../decorators/check-policies.decorator';
import type { AppAbility } from '../casl/app-ability';
import type {
  AppPolicyHandler,
  PolicyHandler,
} from '../policies/policy-handler';

/**
 * Minimal authenticated user shape required by authorization.
 *
 * Better Auth's request user does not need to pretend to be a complete
 * generated Prisma User object.
 *
 * CASL authorization only requires the authenticated identifier.
 */
interface AuthenticatedRequestUser {
  readonly id: number | string;
}

interface AuthenticatedRequest {
  readonly user?: AuthenticatedRequestUser;
}

@Injectable()
export class PoliciesGuard implements CanActivate {
  private readonly context = PoliciesGuard.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * Support metadata declared either:
     *
     *   @CheckPolicies(...) on a method
     *
     * or:
     *
     *   @CheckPolicies(...) on an entire controller
     *
     * Method-level metadata wins.
     */
    const policyHandlers = this.reflector.getAllAndOverride<
      readonly AppPolicyHandler[]
    >(CHECK_POLICIES_KEY, [context.getHandler(), context.getClass()]);

    /**
     * No CASL policy declared.
     *
     * Authentication remains Better Auth's responsibility.
     */
    if (!policyHandlers || policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const requestUser = request.user;

    if (!requestUser) {
      this.logger.warn(
        'Authorization attempted without an authenticated request user.',
      );

      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        this.context,
      );
    }

    const userId = this.resolveUserId(requestUser.id);

    if (userId === undefined) {
      this.logger.warn(
        `Authorization received an invalid user ID: "${String(requestUser.id)}".`,
      );

      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        this.context,
      );
    }

    const ability = await this.caslAbilityFactory.createForUser(userId);

    const allowed = policyHandlers.every((handler) =>
      this.executePolicyHandler(handler, ability),
    );

    if (!allowed) {
      this.logger.warn(`Authorization denied for user ${userId}.`);

      throw new AppError(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        this.context,
      );
    }

    return true;
  }

  private executePolicyHandler(
    handler: AppPolicyHandler,
    ability: AppAbility,
  ): boolean {
    if (typeof handler === 'function') {
      return handler(ability);
    }

    return this.isPolicyHandler(handler) ? handler.handle(ability) : false;
  }

  private isPolicyHandler(value: AppPolicyHandler): value is PolicyHandler {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof value.handle === 'function'
    );
  }

  private resolveUserId(value: number | string): number | undefined {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 ? value : undefined;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
}
