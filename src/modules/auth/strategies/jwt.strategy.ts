import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from 'src/types/token';
import { AppError } from 'src/exceptions/app.exception';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly context = JwtStrategy.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'default-secret-key',
      ),
    });
  }

  async validate(payload: TokenPayload) {
    // const user = await this.userService.getOne({ id: payload.sub });

    // if (
    //   !user ||
    //   user.isBan ||
    //   user.isLocked ||
    //   !user.isEnabled ||
    //   !user.isVerified ||
    //   !user.isActivated
    // ) {
    //   return null;
    // }
    // return user;

    try {
      return await this.authService.validateJwtPayload(payload);
    } catch (error) {
      this.logger.error(`Error validating token payload`, error);
      throw new AppError(
        'Invalid token payload',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }

    // return {
    //   id: user.id,
    //   username: user.username,
    //   email: user.email,
    //   avatar: user.avatar,
    //   role: {
    //     id: user.role.id,
    //     name: user.role.name,
    //     description: user.role.description,
    //   },
    //   authMethod: user.authMethod,
    //   providers: user.identities.map((i) => i.provider.name),
    //   isVerified: user.isVerified,
    //   ip: payload.ip,
    // };
  }
}

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(configService: ConfigService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: configService.get<string>('JWT_SECRET'),
//     });
//   }

//   async validate(payload: JwtPayload) {
//     return { userId: payload.sub, email: payload.email };
//   }
// }
