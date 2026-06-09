import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from 'exceptions/app.exception';
import { Request } from 'express';
import { CaslAbilityFactory } from 'factories/casl-ability.factory';
import { User } from 'generated/prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly context = PermissionsGuard.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<[string, string]>(
      'permissions',
      context.getHandler(),
    );
    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User; // set by Better Auth session guard
    if (!user) {
      this.logger.error('Access denied! Authentication Bearer not found!');
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        this.context,
      );
    }
    const userId = user.id;
    if (!userId) return false;

    const ability = await this.caslAbilityFactory.createForUser(userId);
    const [action, subject] = requiredPermissions;

    return ability.can(action, subject);
  }
}
