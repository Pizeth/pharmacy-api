import {
  HttpStatus,
  Injectable,
  Logger,
  // UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditTrail, RefreshToken } from '@prisma/client';
import { Profile } from 'passport-openidconnect';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from 'src/commons/services/token.service';
import { AppError } from 'src/exceptions/app.exception';
import { NormalizedProfile } from 'src/modules/ocid/interfaces/oidc.interface';
import { OidcIdentityDbService } from 'src/modules/ocid/services/oidc-identity-db.service';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';
import { UsersService } from 'src/modules/users/services/users.service';
import { SignedUser, UserDetail } from 'src/types/dto';
import { id } from 'zod/v4/locales';

@Injectable()
export class AuthService {
  private readonly context = AuthService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly oidcProviderServie: OidcProviderService,
    private readonly oidcIdentityServie: OidcIdentityDbService,
    private readonly passwordUtil: PasswordUtils,
    private readonly tokenService: TokenService,
  ) {}

  async validateUser(username: string, pass: string): Promise<SignedUser> {
    const user = await this.usersService.getUser(username);
    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async validateLocalUser(
    username: string,
    password: string,
  ): Promise<UserDetail> {
    // const user = await this.usersService.getUser(username);
    // if (user && (await bcrypt.compare(password, user.password))) {
    //   // const { password, ...result } = user;
    //   // After validation succeeds, transform the object by creating a mutable copy of the validated data.
    //   const result = user;
    //   // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
    //   delete (result as { password?: string }).password; // Cleanly remove the repassword field
    //   return result;
    // }
    // return user;

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

      if (
        user.password &&
        !this.passwordUtil.compare(password, user.password)
      ) {
        // Increment login attempts
        // await UserRepo.incrementLoginAttempts(user.toData());
        // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
        // this.logger.error('Username password');
        throw new AppError(
          'Invalid credentials',
          HttpStatus.UNAUTHORIZED,
          this.context,
          {
            cause: 'Invalid username or password!',
            desription: `User ${username} provided incorrect credentials!`,
          },
        );
      }

      // Reset login attempts on successful login
      // await UserRepo.resetLoginAttempts(user.id);

      // Record successful login attempt and update last login
      // await loginRepo.recordLoginAttempt(user, req, 'SUCCESS');

      // Generate payload to use for create token
      const payload = this.tokenService.generatePayload(user);

      // Generate authentication token
      const token = await this.tokenService.generateToken(payload, '10:25:55');

      // Save refresh token to database
      const refreshToken = await this.tokenService.generateRefreshToken(
        payload,
        '1 hour 2min 55 sec',
      );

      // After validation succeeds, transform the object by creating a mutable copy of the validated data.
      const result = user;
      // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
      delete (result as { password?: string }).password; // Cleanly remove the repassword field

      // TODO: Generate a JWT and return it here
      // instead of the user object
      // const payload = { sub: user.id, username: user.username };
      return result;
    } catch (error: unknown) {
      this.logger.error(
        'Error occured during authenticate user credentials:',
        error,
      );
      // throw new UnauthorizedException();
      throw new AppError(
        'Error occured during authenticate user credentials',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  // async findOrCreateOidcUser(profile: NormalizedProfile): Promise<any> {
  //   // Check by provider ID
  //   let user = await this.usersService.findByProviderId(
  //     profile.provider,
  //     profile.providerId,
  //   );

  //   if (user) return user;

  //   // Check by email
  //   if (profile.email) {
  //     user = await this.usersService.findByEmail(profile.email);
  //   }

  //   if (user) {
  //     // Link provider to existing account
  //     return this.usersService.addProvider(user.id, {
  //       provider: profile.provider,
  //       providerId: profile.providerId,
  //     });
  //   }

  //   // Create new user
  //   return this.usersService.create({
  //     email: profile.email,
  //     name: profile.name,
  //     avatar: profile.picture,
  //     isEmailVerified: profile.emailVerified,
  //     providers: [
  //       {
  //         provider: profile.provider,
  //         providerId: profile.providerId,
  //       },
  //     ],
  //   });
  // }

  async findOrCreateOidcUser(
    providerName: string,
    profile: NormalizedProfile,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
  ) {
    try {
      // 1. Find provider
      const provider =
        await this.oidcProviderServie.getOidcIdentityProvider(providerName);

      // if (!provider)
      //   throw new AppError(
      //     'Provider not found',
      //     HttpStatus.NOT_FOUND,
      //     this.context,
      //     {
      //       cause: `Provider ${providerName} not found!`,
      //       validProvider: this.oidcServie.getAllEnabledProviders(),
      //     },
      //   );

      // 2. Find existing identity
      const identity = await this.oidcIdentityServie.getOidcIdentity(
        provider.id,
        profile.id,
      );
      // const identity = await this.prisma.userIdentity.findFirst({
      //   where: {
      //     providerId: provider.id,
      //     providerUserId: profile.id,
      //   },
      //   include: { user: true },
      // });

      if (identity) {
        // Update tokens
        await this.oidcIdentityServie.update(identity.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        return identity.user;
      }

      // 3. Find user by email to link identity
      if (profile.email) {
        const user = await this.usersService.getUser(profile.email);
        // const user = await this.prisma .prismauser.findUnique({
        //   where: { email: profile.email },
        // });

        if (user) {
          // Link identity to existing user
          return await this.oidcIdentityServie.create({
            providerId: provider.id,
            userId: user.id,
            providerUserId: profile.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
          });
          // .create({
          //   data: {
          //     providerId: provider.id,
          //     userId: user.id,
          //     providerUserId: profile.providerId,
          //     accessToken: tokens.accessToken,
          //     refreshToken: tokens.refreshToken,
          //     idToken: tokens.idToken,
          //     expiresAt: tokens.expiresAt,
          //   },
          // })
          // .then(() => user);
        }
      }

      // 4. Create new user
      return this.createUserWithIdentity(provider.id, profile, tokens);
    } catch (error) {
      this.logger.error('Error occured during findOrCreateOidcUser:', error);
      throw new AppError(
        'Error occured during findOrCreateOidcUser',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  private async createUserWithIdentity(
    providerId: number,
    profile: NormalizedProfile,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresAt?: Date;
    },
  ) {
    const username = await this.generateUniqueUsername(profile.email);

    return this.prisma.user.create({
      data: {
        email: profile.email,
        username,
        avatar: profile.picture,
        isVerified: true,
        role: { connect: { id: 2 } }, // Default role
        identities: {
          create: {
            providerId,
            providerUserId: profile.providerId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            idToken: tokens.idToken,
            expiresAt: tokens.expiresAt,
          },
        },
        profile: profile.name
          ? {
              create: {
                first_name: profile.name.split(' ')[0],
                last_name: profile.name.split(' ').slice(1).join(' ') || '',
              },
            }
          : undefined,
      },
    });
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const base = email.split('@')[0];
    let username = base;
    let counter = 1;

    while (true) {
      const existing = await this.usersService.getUser(username);

      if (!existing) return username;

      username = `${base}${counter}`;
      counter++;
    }
  }

  sanitizeUser(user: UserDetail) {
    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.mfaSecret;
    delete sanitized.refreshTokens;
    return sanitized;
  }

  async signIn(username: string, pass: string): Promise<SignedUser> {
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

      if (!this.passwordUtil.compare(pass, user.password)) {
        // Increment login attempts
        // await UserRepo.incrementLoginAttempts(user.toData());
        // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
        // this.logger.error('Username password');
        throw new AppError(
          'Invalid credentials',
          HttpStatus.UNAUTHORIZED,
          this.context,
          {
            cause: 'Invalid username or password!',
            desription: `User ${username} provided incorrect credentials!`,
          },
        );
      }

      // Reset login attempts on successful login
      // await UserRepo.resetLoginAttempts(user.id);

      // Record successful login attempt and update last login
      // await loginRepo.recordLoginAttempt(user, req, 'SUCCESS');

      // Generate payload to use for create token
      const payload = this.tokenService.generatePayload(user);

      // Generate authentication token
      const token = await this.tokenService.generateToken(payload, '10:25:55');

      // Save refresh token to database
      const refreshToken = await this.tokenService.generateRefreshToken(
        payload,
        '1 hour 2min 55 sec',
      );

      // After validation succeeds, transform the object by creating a mutable copy of the validated data.
      const result = user;
      // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
      delete (result as { password?: string }).password; // Cleanly remove the repassword field
      delete (result as { repassword?: string }).repassword; // Cleanly remove the repassword field
      delete (result as { refreshTokens?: RefreshToken }).refreshTokens; // Cleanly remove the repassword field
      delete (result as { auditTrail?: AuditTrail }).auditTrail; // Cleanly remove the repassword field

      // TODO: Generate a JWT and return it here
      // instead of the user object
      // const payload = { sub: user.id, username: user.username };
      return {
        // access_token: await this.jwtService.signAsync(payload),
        user: result,
        token: token,
        refreshToken: refreshToken.token,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error occured during authenticate user credentials:',
        error,
      );
      // throw new UnauthorizedException();
      throw new AppError(
        'Error occured during authenticate user credentials',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }
}
