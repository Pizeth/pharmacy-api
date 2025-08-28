// src/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { Roles } from 'src/decorators/roles.decorator';
import { AppError } from 'src/exceptions/app.exception';
import { SanitizedUser } from 'src/types/dto';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly context = RolesGuard.name;
  private readonly logger = new Logger(this.context);
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Get the required roles from the custom @Roles() decorator on the route
    const roles = this.reflector.getAllAndOverride<string[]>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) {
      return true; // If no roles are required, allow access
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as SanitizedUser;
    if (!user) {
      this.logger.error('Access denied! Authentication Bearer not found!');
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        this.context,
      );
    }
    return this.matchRoles(roles, user ? user.role.name : '');
  }

  // const { user } = context.switchToHttp().getRequest();
  // return requiredRoles.some((role) => user.roles?.includes(role));

  private matchRoles(roles: string[], role: string): boolean {
    // Check if the user's role is included in the list of required roles
    return roles.some((r) => role === r);
  }
}

// // Role-based authorization middleware
// export const roleMiddleware = (roles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       error(res, 401, 'Authentication required');
//       //   return res.status(401).json({ message: "Authentication required" });
//     }

//     // Check if the user's role is in the allowed roles
//     if (!roles.includes(req.user.role)) {
//       error(res, 401, 'Access denied');
//       //   return res.status(403).json({ message: "Access denied" });
//     }
//     next();
//   };

//   //   return (req, res, next) => {
//   //     if (!req.user) {
//   //       return res.status(401).json({ message: "Authentication required" });
//   //     }

//   //     // Check if the user's role is in the allowed roles
//   //     if (!roles.includes(req.user.role)) {
//   //       return res.status(403).json({
//   //         message: "Access denied",
//   //         userRole: req.user.role,
//   //         allowedRoles,
//   //       });
//   //     }

//   //     next();
//   //   };
// };
