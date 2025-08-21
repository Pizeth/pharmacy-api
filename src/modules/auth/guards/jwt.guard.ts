import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { TokenService } from 'src/commons/services/token.service';
import { AccessLevel } from 'src/types/commons.enum';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    // private jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {
    super();
  }
  canActivate(context: ExecutionContext) {
    // Add your custom authentication logic here
    // for example, call super.logIn(request) to establish a session.
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AccessLevel.IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      // 💡 See this condition
      return true;
    }

    return super.canActivate(context);
  }

  //   handleRequest(err, user, info) {
  //     // You can throw an exception based on either "info" or "err" arguments
  //     if (err || !user) {
  //       throw err || new UnauthorizedException();
  //     }
  //     return user;
  //   }
}
