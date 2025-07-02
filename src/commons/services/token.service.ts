// src/services/access-token.service.ts
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { RefreshToken } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { Sanitized, SensitiveKey, TokenPayload } from 'src/types/token';
// import { AppError } from 'src/middlewares/app-errors.middleware';
import statusCode from 'http-status-codes';
import { AppError } from 'src/exceptions/app.exception';
import { SensitiveField } from 'src/types/commons.enum';
import { ClsService } from 'nestjs-cls';
import { UserDetail } from 'src/types/dto';
import { Algorithm } from 'jsonwebtoken';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly context = TokenService.name;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
  ) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`PrismaService injected: ${!!prisma}`);
    this.logger.debug(`ConfigService injected: ${!!config}`);
    this.logger.debug(`JwtService injected: ${!!jwtService}`);
  }

  /**
   * Helper function to get required configuration values and throw if missing.
   * @param key The environment variable key.
   * @returns The configuration value as a string.
   * @throws Error if the key is not found or is empty.
   */
  private getRequiredConfig1(
    key: string,
    defaultValue: string = '',
  ): string | number | boolean | object {
    // Null-safe access
    if (!this.config) {
      throw new AppError(
        'ConfigService is not available',
        HttpStatus.SERVICE_UNAVAILABLE,
        this.context,
        {
          error: `Dependency Injection failed: ${String(this.config)}`,
        },
      );
    }

    // Check if value available for this key
    const value = this.config.get<string>(key, defaultValue);

    if (!value || value.length === 0) {
      Logger.error(`Missing configuration: ${key}`, this.context);
      throw new AppError(
        `Required configuration '${key}' is missing`,
        HttpStatus.NOT_IMPLEMENTED,
        this.context,
        { error: `Missing configuration: ${key}` },
      );
    }

    return value;
  }

  private getRequiredConfig<T>(
    key: string,
    parser: (raw: string) => T,
    defaultValue?: T,
  ): T {
    // Null-safe access
    if (!this.config) {
      throw new AppError(
        'ConfigService is not available',
        HttpStatus.SERVICE_UNAVAILABLE,
        this.context,
        {
          error: `Dependency Injection failed: ${String(this.config)}`,
        },
      );
    }

    const raw = this.config.get<string | undefined>(key);
    if (raw == null || raw === '') {
      if (defaultValue !== undefined) return defaultValue;
      Logger.error(`Missing configuration: ${key}`, this.context);
      throw new AppError(
        `Required configuration '${key}' is missing`,
        HttpStatus.NOT_IMPLEMENTED,
        this.context,
        { error: `Missing configuration: ${key}` },
      );
    }

    try {
      // if (key === 'JWT_REFRESH_EXPIRES_IN') {
      //   this.logger.debug(`value is ${raw}`);
      //   this.logger.warn(
      //     `Value after  parse ${parser(raw) as unknown as string}`,
      //   );
      // }
      return parser(raw);
    } catch (error: unknown) {
      throw new AppError(
        `Failed to parse ${key}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  // Getter methods for lazy loading configuration
  private get expiresIn(): number | string {
    return this.getRequiredConfig(
      'JWT_EXPIRES_IN',
      this.parseNumberOrString.bind(this),
    );
  }

  private get expireRefresh(): number | string {
    return this.getRequiredConfig(
      'JWT_REFRESH_EXPIRES_IN',
      this.parseNumberOrString.bind(this),
    );
  }

  private get secretKey(): string {
    return this.getRequiredConfig('JWT_SECRET', String);
  }

  private get refreshTokenKey(): string {
    return this.getRequiredConfig('JWT_REFRESH_SECRET', String);
  }

  private get issuer(): string {
    return this.getRequiredConfig('JWT_ISSUER', String);
  }

  private get audience(): string {
    return this.getRequiredConfig('JWT_AUDIENCE', String);
  }

  private get algorithm(): Algorithm {
    return this.getRequiredConfig(
      'JWT_ALGORITHM',
      (raw) => raw as Algorithm,
      'HS256',
    );
  }

  /**
   * Composite parser: if it’s a valid number, return → number;
   * otherwise, fall back to the original string.
   */
  private parseNumberOrString(raw: string): number | string {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }

  // private get algorithm(): Algorithm {
  //   return this.getRequiredConfig('JWT_ALGORITHM', (raw) => raw as Algorithm);
  // }

  generatePayload(payload: UserDetail): TokenPayload {
    const ip = this.cls.get<string>('ip') || '';
    return {
      sub: payload.id,
      username: payload.username,
      email: payload.email,
      avatar: payload.avatar,
      role: {
        id: payload.role.id,
        name: payload.role.name,
        description: payload.role.description,
      },
      authMethod: payload.authMethod,
      ip: ip,
    };
  }

  // Generate access token
  // generateToken(
  //   payload: TokenPayload | { filename: string },
  //   expiresIn: string = this.expiresIn,
  // ): string {
  //   try {
  //     return this.jwtService.sign(payload, {
  //       expiresIn,
  //       secret: this.secretKey,
  //     });
  //   } catch (error: unknown) {
  //     throw new AppError(
  //       'Failed to generate tokend',
  //       statusCode.UNPROCESSABLE_ENTITY,
  //       error,
  //     );
  //   }
  // }

  // Update generateToken to access config when needed
  async generateToken(
    payload: TokenPayload | { filename: string },
    secret: string | Buffer = this.secretKey,
    expiresIn: number | string = this.expiresIn,
    issuer: string = this.issuer,
    audience: string = this.audience,
    algorithm: Algorithm = this.algorithm,
  ): Promise<string> {
    // this.logger.debug(`Expires In: ${expiresIn}`);
    try {
      return await this.jwtService.signAsync(payload, {
        expiresIn,
        secret,
        issuer,
        audience,
        algorithm,
      });
    } catch (error: unknown) {
      throw new AppError(
        'Failed to generate token',
        statusCode.UNPROCESSABLE_ENTITY,
        this.context,
        error,
      );
    }
  }

  // Generate refresh tokens
  async generateRefreshToken(payload: TokenPayload): Promise<RefreshToken> {
    const token = await this.generateToken(
      payload,
      this.refreshTokenKey,
      this.expireRefresh,
    );
    try {
      return await this.createRefreshToken(token, payload.sub);
    } catch (error: unknown) {
      console.error('Error saving refresh token:', error);
      throw new AppError(
        'Failed to save refresh tokend',
        statusCode.GONE,
        this.context,
        error,
      );
    }
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.refreshTokenKey,
    });
  }

  // Verify the access token
  async verifyTokenClaims(token: string, req: Request): Promise<TokenPayload> {
    try {
      // Verify the token with your secret key
      const verifiedToken = await this.jwtService.verifyAsync<TokenPayload>(
        token,
        {
          secret: this.secretKey,
          algorithms: ['HS256'], // Specify allowed algorithms
          // Optional: add additional verification options
          complete: false, // Returns the decoded payload
        },
      );

      // Define required claims
      const requiredClaims = ['sub', 'username', 'email', 'roleId', 'ip'];

      // Check for undefined or null claims
      const invalidClaims = requiredClaims.filter(
        (claim) =>
          verifiedToken[claim as keyof TokenPayload] === undefined ||
          verifiedToken[claim as keyof TokenPayload] === null ||
          verifiedToken[claim as keyof TokenPayload] === '',
      );

      // If any required claims are invalid, throw an error
      if (invalidClaims.length > 0) {
        throw new AppError(
          `Invalid token: Undefined or null claims - ${invalidClaims.join(
            ', ',
          )}`,
          HttpStatus.EXPECTATION_FAILED,
          this.context,
          {
            errors: `Expect the following claim ${requiredClaims.join(', ')} but get ${invalidClaims.join(
              ', ',
            )}`,
          },
        );
      }

      return verifiedToken;
    } catch (error: unknown) {
      // Handle different types of JWT verification errors
      if (error instanceof TokenExpiredError) {
        this.logger.error('JWT Token Expired', {
          error: error.message,
          ip: req.ip,
        });
        throw new AppError(
          'Authentication failed: Token has expired',
          statusCode.UNAUTHORIZED,
          this.context,
          error,
        );
      }

      if (error instanceof JsonWebTokenError) {
        // Signature verification failed
        this.logger.error('JWT Signature Verification Failed', {
          error: error.message,
          ip: req.ip, // Assuming you have a method to get current IP
        });
        throw new AppError(
          'Authentication failed: Invalid token signature',
          statusCode.UNAUTHORIZED,
          this.context,
          error,
        );
      }
      // // Log the error for security monitoring
      // this.logger.security("Token verification failed", {
      //   error: error.message,
      //   tokenDetails: this.sanitizeTokenForLogging(decodedToken),
      // });
      // Re-throw other errors
      throw error;
      // // Throw a generic error to prevent information leakage
      // throw new Error("Authentication failed");
    }
  }

  // Helper method to sanitize token for logging
  // sanitizeTokenForLogging1(token: TokenPayload) {
  //   if (!token) return null;

  //   // Create a copy of the token to avoid modifying the original
  //   const sanitizedToken = { ...token };

  //   // ① tell TS these are actual keys of TokenPayload
  //   // const sensitiveFields: (keyof TokenPayload)[] = ['id', 'username', 'email'];
  //   const sensitiveFields = ['id', 'username', 'email'] as const;
  //   // Mask sensitive information
  //   // const sensitiveFields = ['id', 'username', 'email'];

  //   sensitiveFields.forEach((field) => {
  //     if (sanitizedToken[field]) {
  //       sanitizedToken[field] = this.maskSensitiveData(sanitizedToken[field]);
  //     }
  //   });

  //   return sanitizedToken;
  // }

  /**
   * Sanitizes sensitive fields in a token object for safe logging.
   *
   * This method creates a shallow copy of the provided token object and replaces the values
   * of fields marked as sensitive (as defined by the `SensitiveField` enum) with masked versions,
   * using the `maskSensitiveData` method. If the token is `null`, it returns `null`.
   *
   * @typeParam T - The type of the token object, which must have keys corresponding to `SensitiveKey`.
   * @param token - The token object to sanitize, or `null`.
   * @returns A sanitized copy of the token with sensitive fields masked, or `null` if the input was `null`.
   */
  sanitizeTokenForLogging<T extends Record<SensitiveKey, unknown>>(
    token: T | null,
  ): Sanitized<T> | null {
    if (!token) return null;

    // 1) Make a shallow copy and assert the new shape:
    const sanitizedToken = { ...token } as Sanitized<T>;

    // 2) Iterate your enum values (narrowed as SensitiveKey[])
    for (const key of Object.values(SensitiveField) as SensitiveKey[]) {
      const raw = token[key];
      if (raw != null) {
        // Now out[key] is known to be `string`, so this is safe:
        sanitizedToken[key] = this.maskSensitiveData(raw);
      }
    }

    return sanitizedToken;
  }

  // Helper method to mask sensitive data
  /**
   * Masks sensitive data in a string by replacing all but the first two and last two characters with asterisks.
   * If the string has 3 or fewer characters, all characters are replaced with asterisks.
   * if the data is a number, it will be replace with asterisks.
   * For non-string data, the value is converted to a string and returned as-is.
   *
   * @param data - The data to be masked. If not a string, it will be stringified.
   * @returns The masked string if input is a string, otherwise the stringified input.
   */
  maskSensitiveData(data: unknown): string {
    if (typeof data === 'string') {
      return data.length > 3
        ? `${data.substring(0, 2)}${'*'.repeat(data.length - 4)}${data.slice(
            -2,
          )}`
        : '*'.repeat(data.length);
    }
    if (typeof data === 'number') {
      return '***';
    }
    return String(data);
  }

  static verifyMFAToken() {}

  // Check if refresh token exists in database
  async findToken(token: string): Promise<RefreshToken | null> {
    try {
      return await this.prisma.refreshToken.findUnique({
        where: { token: token },
        include: { user: true },
      });
    } catch (error) {
      console.error('Error fetching refresh token:', error);
      throw new AppError(
        'Failed to fetch refresh token',
        statusCode.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

  // Remove refresh token from database
  async removeTokens(token: string) {
    try {
      return await this.prisma.refreshToken.deleteMany({
        where: { token: token },
      });
    } catch (error) {
      console.error('Error deleting refresh token:', error);
      throw error;
    }
  }

  // Save refresh token to database
  async createRefreshToken(token: string, id: number) {
    try {
      return await this.prisma.refreshToken.create({
        data: {
          token: token,
          userId: id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  }
}
