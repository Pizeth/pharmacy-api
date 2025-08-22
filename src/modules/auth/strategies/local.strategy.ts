import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  private readonly context = LocalStrategy.name;
  private readonly logger = new Logger(this.context);
  constructor(private authService: AuthService) {
    super();
  }

  async validate(credential: string, password: string): Promise<any> {
    try {
      const user = await this.authService.validateLocalUser(
        credential,
        password,
      );
      return user;
    } catch (error) {
      this.logger.error(`Error validating user credentials`, error);
      throw new AppError(
        'Error validating user credentials',
        HttpStatus.UNAUTHORIZED,
        this.context,
        {
          cause: error,
        },
      );
    }

    // if (!user) {
    //   this.logger.warn(
    //     `Invalid credentials for user: ${credential}`,
    //     this.context,
    //   );
    //   throw new AppError(
    //     'Invalid credentials',
    //     HttpStatus.UNAUTHORIZED,
    //     this.context,
    //     {
    //       cause: new UnauthorizedException(),
    //     },
    //   );
    // }
    // return user;
  }
}
