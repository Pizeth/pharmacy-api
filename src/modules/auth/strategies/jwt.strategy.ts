import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from 'src/types/token';
import { UsersService } from 'src/modules/users/services/users.service';
import { TokenService } from 'src/commons/services/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly tokenService: TokenService,
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
    const user = await this.userService.getOne({ id: payload.sub });

    if (
      !user ||
      user.isBan ||
      user.isLocked ||
      !user.isEnabled ||
      !user.isVerified ||
      !user.isActivated
    ) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description,
      },
      authMethod: user.authMethod,
      providers: user.identities.map((i) => i.provider.name),
      isVerified: user.isVerified,
      ip: payload.ip,
    };
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
