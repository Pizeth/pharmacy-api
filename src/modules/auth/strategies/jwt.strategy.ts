import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from 'src/types/token';
import { AppError } from 'src/exceptions/app.exception';
import { AuthService } from '../services/auth.service';
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
  }
}
