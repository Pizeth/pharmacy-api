import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from 'src/types/token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        identities: {
          include: {
            provider: true,
          },
        },
      },
    });

    if (!user || user.isBan || !user.enabledFlag) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name,
      providers: user.identities.map((i) => i.provider.name),
      isVerified: user.isVerified,
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
