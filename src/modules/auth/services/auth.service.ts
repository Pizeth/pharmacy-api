import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditTrail,
  LoginStatus,
  Prisma,
  RefreshToken,
  UserIdentity,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from 'src/commons/services/token.service';
import { AppError } from 'src/exceptions/app.exception';
import { NormalizedProfile } from 'src/modules/ocid/interfaces/oidc.interface';
import { OidcIdentityDbService } from 'src/modules/ocid/services/oidc-identity-db.service';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';
import { UsersService } from 'src/modules/users/services/users.service';
import {
  AccessToken,
  SanitizedUser,
  SignedUser,
  UserDetail,
} from 'src/types/dto';
import { TokenPayload } from 'src/types/token';
import { UAParser } from 'ua-parser-js';
import {
  INVALID_CREDENTIALS,
  TOO_MANY_FAILED_ATTEMPTS,
  USER_BANNED_OR_DELETED,
  USER_LOCKED,
  USER_NOT_ACTIVATED,
  USER_NOT_FOUND,
  VALID_CREDENTIALS,
} from '../const/user-state.const';
import { Token } from 'src/modules/ocid/types/token';

@Injectable()
export class AuthService {
  private readonly context = AuthService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly oidcProviderService: OidcProviderService,
    private readonly oidcIdentityService: OidcIdentityDbService,
    private readonly passwordUtil: PasswordUtils,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async validateLocalUser(
    username: string,
    password: string,
  ): Promise<SanitizedUser> {
    try {
      const user = await this.usersService.getUser(username);

      // Check if user existed
      if (!user || !user.password) {
        await this.recordLoginAttempt(
          username,
          LoginStatus.FAILED,
          USER_NOT_FOUND,
          this.cls,
        );
        throw new AppError(
          'User not found!',
          HttpStatus.NOT_FOUND,
          this.context,
          `No user associated with ${username}`,
        );
      }

      const id = user.id;

      // Check if user is banned or deleted
      if (user.isBan || !user.isEnabled) {
        await this.recordLoginAttempt(
          user,
          LoginStatus.FAILED,
          USER_BANNED_OR_DELETED,
          this.cls,
        );
        throw new AppError(
          'Account is banned or inactive!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} is banned or inactive!`,
        );
      }

      // Check if user is locked
      if (user.isLocked) {
        await this.recordLoginAttempt(
          user,
          LoginStatus.FAILED,
          USER_LOCKED,
          this.cls,
        );
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
        await this.usersService.update(id, { isLocked: true });
        await this.recordLoginAttempt(
          user,
          LoginStatus.FAILED,
          TOO_MANY_FAILED_ATTEMPTS,
          this.cls,
        );
        throw new AppError(
          'Too many failed attempts, account is locked!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} is locked, due to multiple failed attempts.`,
        );
      }

      if (!user.isActivated) {
        await this.recordLoginAttempt(
          user,
          LoginStatus.FAILED,
          USER_NOT_ACTIVATED,
          this.cls,
        );
        throw new AppError(
          'Account is not activated!',
          HttpStatus.FORBIDDEN,
          this.context,
          `User ${username} account is not activated!`,
        );
      }

      if (
        user.password &&
        !this.passwordUtil.compare(password, user.password)
      ) {
        // If the password does not match then increment login attempts
        await this.usersService.update(id, {
          loginAttempts: user.loginAttempts + 1,
          isLocked:
            user.loginAttempts >= this.configService.get<number>('LOCKED', 5), // Lock after 5 failed attempts
        });

        await this.recordLoginAttempt(
          user,
          LoginStatus.FAILED,
          INVALID_CREDENTIALS,
          this.cls,
        );
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
      await this.usersService.update(id, {
        loginAttempts: 0,
        lastLogin: new Date(),
        isLocked: false,
      });

      // Record successful login attempt and update last login
      await this.recordLoginAttempt(
        user,
        LoginStatus.SUCCESS,
        VALID_CREDENTIALS,
        this.cls,
      );

      // After validation succeeds, transform the user by sanitizing it.
      return this.sanitizeUser(user);
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

  async validateJwtPayload(payload: TokenPayload): Promise<SanitizedUser> {
    const user = await this.usersService.getOne({ id: payload.sub });
    if (
      !user ||
      user.isBan ||
      user.isLocked ||
      !user.isEnabled ||
      !user.isVerified ||
      !user.isActivated
    ) {
      throw new AppError(
        'User not found or inactive',
        HttpStatus.NOT_FOUND,
        this.context,
        `No valid user associated with ${payload.sub}`,
      );
    }

    return user;
  }

  async login(user: SanitizedUser): Promise<SignedUser> {
    // Generate payload to use for create token
    const payload = this.tokenService.generatePayload(user);

    // Generate authentication token
    const token = await this.tokenService.generateToken(payload, '10:25:55');

    // Save refresh token to database
    const refreshToken = await this.tokenService.generateRefreshToken(
      payload,
      '1 hour 2min 55 sec',
    );

    await this.usersService.update(user.id, { lastLogin: new Date() });
    return {
      user,
      accessToken: token,
      refreshToken: refreshToken.token,
    };
  }

  async oidcLogin(
    providerName: string,
    profile: NormalizedProfile,
  ): Promise<SignedUser> {
    try {
      const user = await this.findOrCreateOidcUser(providerName, profile);
      return this.login(user);
    } catch (error) {
      this.logger.error('Error occured during OIDC login:', error);
      throw new AppError(
        'Error occured during OIDC login',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  async oidcLoginDeepSeek(
    providerName: string,
    profile: NormalizedProfile,
    tokens: Token,
  ): Promise<SignedUser> {
    try {
      const user = await this.findOrCreateOidcUserDeepSeek(
        providerName,
        profile,
        tokens,
      );
      return this.login(user);
    } catch (error) {
      this.logger.error('Error during OIDC login:', error);
      throw new AppError(
        'OIDC login failed',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  async register(registerDto: CreateUserDto, file?: Express.Multer.File) {
    try {
      // Create user
      const user = await this.usersService.create(registerDto, file);
      return this.login(user);
    } catch (error) {
      this.logger.error('Error occured during user registration:', error);
      throw new AppError(
        'Error occured during user registration',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  async findOrCreateOidcUser(
    providerName: string,
    profile: NormalizedProfile,
  ): Promise<SanitizedUser> {
    try {
      // 1. Find provider
      const provider =
        await this.oidcProviderService.getOidcIdentityProvider(providerName);

      if (!provider) {
        throw new AppError(
          'Provider not found',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `Provider with name ${providerName} does not exist!`,
            validProvider: this.oidcProviderService.getAllEnabledProviders(),
          },
        );
      }

      // 2. Find existing identity
      const identity = await this.oidcIdentityService.getOidcIdentity({
        // AND: [{ providerUserId: profile.id }, { providerId: provider.id }],
        providerId_providerUserId: {
          providerId: provider.id,
          providerUserId: profile.id,
        },
      });

      if (identity && identity.isEnabled) {
        return identity.user;
      }

      if (identity && identity.user) {
        // Additional check to ensure the associated user is active
        if (!identity.user.isEnabled || identity.user.isBan) {
          throw new AppError(
            'User account is disabled or banned',
            HttpStatus.FORBIDDEN,
            this.context,
          );
        }
        return identity.user;
      }

      // 3. Find user by email to link identity
      if (profile.email) {
        const user = await this.usersService.getUser(profile.email);
        if (user) {
          // Link identity to existing user
          await this.linkOIDCAccount(user.id, provider.id, profile);
          return this.sanitizeUser(user);
        }
      }

      // 4. Create new user if no identity or email match is found
      const user = await this.createUserWithIdentity(provider.id, profile);
      return user;
    } catch (error) {
      this.logger.error('Error occured during findOrCreateOidcUser:', error);
      if (error instanceof AppError) {
        throw error; // Re-throw custom errors
      }

      throw new AppError(
        'Error occured during findOrCreateOidcUser',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  async findOrCreateOidcUserDeepSeek(
    providerName: string,
    profile: NormalizedProfile,
    tokens: Token,
  ): Promise<SanitizedUser> {
    const provider =
      await this.oidcProviderService.getOidcIdentityProvider(providerName);

    if (!provider) {
      throw new AppError('Provider not found', HttpStatus.NOT_FOUND);
    }

    // Find existing identity
    const identity = await this.oidcIdentityService.getOidcIdentity({
      providerId: provider.id,
      providerUserId: profile.id,
    });

    if (identity) {
      // Update tokens
      await this.oidcIdentityService.update(identity.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
      return identity.user;
    }

    // Find by email
    if (profile.email) {
      const user = await this.usersService.getUser(profile.email);
      if (user) {
        await this.linkOIDCAccount(user.id, provider.id, profile, tokens);
        return this.sanitizeUser(user);
      }
    }

    // Create new user
    return this.createUserWithIdentity(provider.id, profile, tokens);
  }

  async refresh(refreshToken: string): Promise<AccessToken> {
    try {
      const token = await this.tokenService.verifyTokenClaims(refreshToken);
      const user = await this.usersService.getOne({ id: token.sub });

      if (!user)
        throw new AppError(
          'User not found!',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `No user associated with ${token.sub}, posibly deleted or false token!`,
          },
        );

      return this.login(user);
    } catch {
      throw new AppError(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
        this.context,
        `Failed to verify refresh token: ${refreshToken}`,
      );
    }
  }

  async linkOIDCAccount(
    userId: number,
    providerId: number,
    profile: NormalizedProfile,
  ) {
    try {
      // 1. Find OIDC identity
      const existingOIDCUser = await this.oidcIdentityService.getOidcIdentity({
        // id: Number(profile.id),
        // AND: [{ providerUserId: profile.id }, { providerId }],
        providerId_providerUserId: {
          providerId,
          providerUserId: profile.id,
        },
      });

      // 2. Check if OIDC ID is already linked to another account
      if (
        existingOIDCUser &&
        existingOIDCUser.isEnabled &&
        existingOIDCUser.userId !== userId
      ) {
        throw new AppError(
          `This ${profile.provider} account is already linked to another user`,
          HttpStatus.CONFLICT,
          this.context,
          {
            cause: `This ${profile.provider} account is currently linked to ${existingOIDCUser.user.email}!`,
          },
        );
      }

      // 3. Prepare data and link OIDC account
      const data = {
        providerId,
        userId,
        providerUserId: profile.id,
        isEnabled: true,
      };

      const ocidUser = !existingOIDCUser
        ? await this.oidcIdentityService.create(data)
        : await this.oidcIdentityService.update(existingOIDCUser.id, data);

      // 4. Update avatar if not set
      if (profile.photo && !ocidUser.user.avatar) {
        await this.usersService.update(userId, {
          avatar: profile.photo,
        });
      }

      // 5. Return OIDC user
      return ocidUser;
    } catch (error) {
      this.logger.error('Error occured during lOIDC account linking:', error);
      throw new AppError(
        'Error occured during lOIDC account linking',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  async unlinkOIDCAccount(id: number, provider: string) {
    try {
      const user = await this.usersService.getOne({ id });

      // Check if user existed
      if (!user) {
        throw new AppError(
          'User not found!',
          HttpStatus.NOT_FOUND,
          this.context,
          `No user associated with ${id}`,
        );
      }

      // Find oidc identity
      const identity = user.identities.find(
        (identity) => identity.provider.displayName === provider,
      );

      // Check if oidc identity existed
      if (!identity) {
        throw new AppError(
          'No OIDC account found!',
          HttpStatus.NOT_FOUND,
          this.context,
          `No ${provider} account associated with ${user.email}`,
        );
      }

      // Check if user has set password before unlinking
      if (!user.password && identity.providerUserId) {
        throw new AppError(
          `Cannot unlink ${provider} account without setting a password first`,
          HttpStatus.CONFLICT,
          this.context,
        );
      }

      // Unlink OIDC account
      return await this.oidcIdentityService.update(identity.id, {
        isEnabled: false,
      });
    } catch (error) {
      this.logger.error('Error occured during unlinkOIDCAccount:', error);
      throw new AppError(
        'Error occured during unlinkOIDCAccount',
        HttpStatus.UNAUTHORIZED,
        this.context,
        error,
      );
    }
  }

  private async recordLoginAttempt(
    user: string | SanitizedUser,
    status: LoginStatus,
    reason: string | null = null,
    cls: ClsService,
  ) {
    try {
      const userAgent = new UAParser(cls.get('userAgent'));
      const result = await this.prisma.loginAttempt.create({
        data: {
          userId: typeof user === 'string' ? null : user.id,
          username: typeof user === 'string' ? user : user.username,
          ipAddress: cls.get<string>('ipAddress'),
          status,
          reason,
          locale: cls.get<string>('acceptLanguage'),
          referer: cls.get<string>('referer'),
          userAgent: JSON.stringify(userAgent.getResult()),
        },
      });
      return result;
    } catch (error) {
      this.logger.error('Error recording user login attempt:', error);
      throw new AppError(
        'Error recording user login attempt',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  private async createUserWithIdentity(
    providerId: number,
    profile: NormalizedProfile,
  ): Promise<SanitizedUser> {
    try {
      const username = await this.generateUniqueUsername(profile.email);

      const placeholderImage = this.usersService.getImagePlaceholder(username);

      // Use an interactive transaction
      const user = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const createdUser = await this.usersService.create(
            {
              username,
              email: profile.email,
              authMethod: ['OIDC'],
              avatar: profile.photo ?? placeholderImage,
              isVerified: true,
              roleId: 4,
            },
            undefined,
            tx,
          );

          await this.oidcIdentityService.create(
            {
              providerId,
              providerUserId: profile.id,
              userId: createdUser.id,
            },
            tx,
          );

          // Return the created user from the transaction
          return createdUser;
        },
      );

      return user;
    } catch (error) {
      this.logger.error('Error creating user with identity:', error);
      throw new AppError(
        'Error creating user with identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
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

  private sanitizeUser(user: UserDetail): SanitizedUser {
    // Transform the object by creating a mutable copy of the validated data.
    const sanitized = { ...user };

    // Explicitly delete the unwanted and sensitive properties.
    delete (sanitized as { password?: string }).password;
    delete (sanitized as { mfaSecret?: string }).mfaSecret;
    delete (sanitized as { identities?: UserIdentity[] }).identities;
    delete (sanitized as { refreshTokens?: RefreshToken }).refreshTokens;
    delete (sanitized as { auditTrail?: AuditTrail }).auditTrail;
    return sanitized;
  }
}

// async signIn(username: string, pass: string): Promise<SignedUser> {
//   try {
//     const user = await this.usersService.getUser(username);

//     // Check if user existed
//     if (!user) {
//       // await loginRepo.recordLoginAttempt(username, req, 'FAILED');
//       throw new AppError(
//         'User not found!',
//         HttpStatus.NOT_FOUND,
//         this.context,
//         `No user associated with ${username}`,
//       );
//     }

//     // Check if user is banned or deleted
//     if (user.isBan || !user.isEnabled) {
//       // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
//       throw new AppError(
//         'Account is banned or inactive!',
//         HttpStatus.FORBIDDEN,
//         this.context,
//         `User ${username} is banned or inactive!`,
//       );
//     }

//     // Check if user is locked
//     if (user.isLocked) {
//       // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
//       throw new AppError(
//         'Account locked due to multiple failed attempts!',
//         HttpStatus.FORBIDDEN,
//         this.context,
//         `User ${username} is locked!`,
//       );
//     } else if (
//       user.loginAttempts >= this.configService.get<number>('LOCKED', 5)
//     ) {
//       // If the user has 5 attempts or more then lock this user
//       // await UserRepo.updateUserStatus(user.id, { isLocked: true });
//       // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
//       throw new AppError(
//         'Too many failed attempts, account is locked!',
//         HttpStatus.FORBIDDEN,
//         this.context,
//         `User ${username} is locked, due to multiple failed attempts.`,
//       );
//     }

//     if (user.password && !this.passwordUtil.compare(pass, user.password)) {
//       // Increment login attempts
//       // await UserRepo.incrementLoginAttempts(user.toData());
//       // await loginRepo.recordLoginAttempt(user, req, 'FAILED');
//       // this.logger.error('Username password');
//       throw new AppError(
//         'Invalid credentials',
//         HttpStatus.UNAUTHORIZED,
//         this.context,
//         {
//           cause: 'Invalid username or password!',
//           desription: `User ${username} provided incorrect credentials!`,
//         },
//       );
//     }

//     // Reset login attempts on successful login
//     // await UserRepo.resetLoginAttempts(user.id);

//     // Record successful login attempt and update last login
//     // await loginRepo.recordLoginAttempt(user, req, 'SUCCESS');

//     // Generate payload to use for create token
//     const payload = this.tokenService.generatePayload(user);

//     // Generate authentication token
//     const token = await this.tokenService.generateToken(payload, '10:25:55');

//     // Save refresh token to database
//     const refreshToken = await this.tokenService.generateRefreshToken(
//       payload,
//       '1 hour 2min 55 sec',
//     );

//     // After validation succeeds, transform the object by creating a mutable copy of the validated data.
//     const result = user;
//     // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
//     delete (result as { password?: string }).password; // Cleanly remove the repassword field
//     delete (result as { repassword?: string }).repassword; // Cleanly remove the repassword field
//     delete (result as { refreshTokens?: RefreshToken }).refreshTokens; // Cleanly remove the repassword field
//     delete (result as { auditTrail?: AuditTrail }).auditTrail; // Cleanly remove the repassword field

//     // TODO: Generate a JWT and return it here
//     // instead of the user object
//     // const payload = { sub: user.id, username: user.username };
//     return {
//       // access_token: await this.jwtService.signAsync(payload),
//       user: result,
//       accessToken: token,
//       refreshToken: refreshToken.token,
//     };
//   } catch (error: unknown) {
//     this.logger.error(
//       'Error occured during authenticate user credentials:',
//       error,
//     );
//     // throw new UnauthorizedException();
//     throw new AppError(
//       'Error occured during authenticate user credentials',
//       HttpStatus.UNAUTHORIZED,
//       this.context,
//       error,
//     );
//   }
// }
