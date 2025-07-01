import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { Request } from 'express';
import { TokenService } from 'src/commons/services/token.service';
import { AppError } from 'src/exceptions/app.exception';
import { AccessLevel } from 'src/types/commons.enum';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly context = AuthGuard.name;
  private readonly logger = new Logger(this.context);
  constructor(
    // private jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AccessLevel.IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      // 💡 See this condition
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    return await this.validateRequest(request);
  }

  private async validateRequest(request: Request): Promise<boolean> {
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.tokenService.verifyTokenClaims(token, request);

      this.logger.log('decode');
      this.logger.debug(this.tokenService.sanitizeTokenForLogging(payload));

      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request.user = payload;
    } catch (error: unknown) {
      if (error instanceof TokenExpiredError) {
        this.logger.error('Token expired:', error);
        throw new AppError(
          'Token expired',
          HttpStatus.UNAUTHORIZED,
          this.context,
          error,
        );
      }
      if (error instanceof JsonWebTokenError) {
        // Signature verification failed
        this.logger.error('JWT Signature Verification Failed', {
          error: error.message,
          // ip: req.ip, // Assuming you have a method to get current IP
        });
        throw new AppError(
          'Authentication failed: Invalid token signature',
          HttpStatus.UNAUTHORIZED,
          this.context,
          error,
        );
      }

      // throw new AppError(`Failed to authenticate token - ${err.message}`, statusCode.FORBIDDEN, err);

      // clientResponse(res, statusCode.FORBIDDEN, `Failed to authenticate token - ${err.message}`);
      // return error(res, 403, `Failed to authenticate token - ${err.message}`);
      this.logger.error('Token verification failed', {
        statu: HttpStatus.FORBIDDEN,
        error: error,
      });
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
