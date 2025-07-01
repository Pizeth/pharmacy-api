import {
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppError } from 'src/exceptions/app.exception';
import { UsersService } from 'src/modules/users/services/users.service';

@Injectable()
export class AuthService {
  private readonly context = AuthService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signIn(
    username: string,
    pass: string,
  ): Promise<{ access_token: string }> {
    try {
      const user = await this.usersService.getUser(username);

      // Check if user existed
      if (!user) {
        // await loginRepo.recordLoginAttempt(username, req, 'FAILED');
        throw new AppError(
          'User not found!',
          HttpStatus.NOT_FOUND,
          this.context,
          `No user associated with ${username}`,
        );
      }

      // Check if user is banned or deleted
      if (user.isBan || !user.enabledFlag) {
        // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
        throw new AppError(
          'Account is banned or inactive!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} is banned or inactive!`,
        );
      }

      // Check if user is locked
      if (user.isLocked) {
        // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
        throw new AppError(
          'Account locked due to multiple failed attempts!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} is locked!`,
        );
      } else if (
        user.loginAttempts >= this.configService.get<number>('LOCKED', 5)
      ) {
        // If the user has 5 attempts or more then lock this user
        // await UserRepo.updateUserStatus(user.id, { isLocked: true });
        // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
        throw new AppError(
          'Too many failed attempts, account is locked!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} is locked, due to multiple failed attempts.`,
        );
      }

      if (user?.password !== pass) {
        this.logger.error('Username password');
        throw new UnauthorizedException();
      }

      // After validation succeeds, transform the object by creating a mutable copy of the validated data.
      const result = user;
      // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
      delete (result as { repassword?: string }).repassword; // Cleanly remove the repassword field

      // TODO: Generate a JWT and return it here
      // instead of the user object
      const payload = { sub: user.id, username: user.username };
      return {
        access_token: await this.jwtService.signAsync(payload),
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error occured during authenticate user credentials:',
        error,
      );
      throw new UnauthorizedException();
    }
  }
}
