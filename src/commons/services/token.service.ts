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
import {
  ALIAS_MAP,
  AmbiguousUnit,
  SensitiveField,
  UNIT_MULTIPLIERS,
  UnitTime,
} from 'src/types/commons.enum';
import { ClsService } from 'nestjs-cls';
import { UserDetail } from 'src/types/dto';
import { Algorithm } from 'jsonwebtoken';
import { TimeParserService } from 'src/modules/time-parser/services/time-parser.service/time-parser.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly context = TokenService.name;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly timeService: TimeParserService,
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
      90000, // Default to expires in 15 mins
    );
  }

  private get expireRefresh(): number | string {
    return this.getRequiredConfig(
      'JWT_REFRESH_EXPIRES_IN',
      this.parseNumberOrString.bind(this),
      '7d', // Default to expires in 7 days
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
    duration: number | string = this.expiresIn,
    secret: string | Buffer = this.secretKey,
    issuer: string = this.issuer,
    audience: string = this.audience,
    algorithm: Algorithm = this.algorithm,
  ): Promise<string> {
    try {
      const expiresIn = this.timeService.getExpiresIn(duration);
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
  async generateRefreshToken(
    payload: TokenPayload,
    duration: number | string = this.expireRefresh,
    secret: string = this.refreshTokenKey,
  ): Promise<RefreshToken> {
    try {
      // const expiresIn = this.timeService.getExpiresIn(duration);
      const expiresAt = this.timeService.getExpiresAt(duration);
      const token = await this.generateToken(payload, duration, secret);
      return await this.createRefreshToken(token, payload.sub, expiresAt);
    } catch (error: unknown) {
      console.error('Failed to generated Refresh Token', error);
      throw new AppError(
        'Failed to generated Refresh Token',
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
  async verifyTokenClaims(token: string, req?: Request): Promise<TokenPayload> {
    try {
      // Verify the token with your secret key
      const verifiedToken = await this.jwtService.verifyAsync<TokenPayload>(
        token,
        {
          secret: this.secretKey || this.refreshTokenKey,
          algorithms: ['HS256'], // Specify allowed algorithms
          // Optional: add additional verification options
          complete: false, // Returns the decoded payload
        },
      );

      // Define required claims
      const requiredClaims = ['sub', 'username', 'email', 'role', 'ip'];

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
          ip: req?.ip,
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
          ip: req?.ip, // Assuming you have a method to get current IP
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

  // Save refresh token to database
  private async createRefreshToken(
    token: string,
    id: number,
    expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  ) {
    try {
      return await this.prisma.refreshToken.create({
        data: {
          token: token,
          userId: id,
          expiresAt: expiresAt,
        },
      });
    } catch (error: unknown) {
      console.error('Error saving refresh token:', error);
      throw error;
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

  /**
   * Returns a future Date object by adding `duration` of specified `unit`
   * @param duration - the amount of time to add
   * @param unit - time unit ('ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'mo')
   */
  // setExpiresAt(duration: number, unit: UnitTime | string): Date {
  //   const now = Date.now();

  //   // const unitMap: Record<typeof unit, number> = {
  //   //   ms: 1,
  //   //   s: 1000,
  //   //   mn: 60_000,
  //   //   h: 3_600_000,
  //   //   d: 86_400_000,
  //   //   w: 604_800_000,
  //   //   m: 2_629_746_000, // Approx. 1 month = 30.44 days
  //   //   y: 31_557_600_000, // Approx. 1 year = 365.25 days
  //   // };

  //   const multiplier = UnitMap[unit as keyof typeof UnitMap];
  //   this.logger.debug('multipler:', multiplier);
  //   if (!multiplier) {
  //     throw new AppError(
  //       `Unsupported time format: ${unit}`,
  //       HttpStatus.EXPECTATION_FAILED,
  //       this.context,
  //       {
  //         cause: `User provided invalid time fomat ${unit}`,
  //         description: `Time format must match one of the following: ${Object.values(UnitTime).join(', ')}`,
  //       },
  //     );
  //   }

  //   return new Date(now + duration * multiplier);
  // }

  /**
   * A convenience method to parse and set the expiration in one step.
   * @param input The duration string or number to parse.
   * @returns A future Date object.
   */
  getExpiresAt(input: string | number): Date {
    const { duration, unit } = this.parseDuration(input);
    return this.setExpiresAt(duration, unit);
  }

  /**
   * Parse strings like "7d", "1.5h", "3600000", or "1mo" into a { duration, unit } pair.
   */
  private parseDuration(input: string | number): {
    duration: number;
    unit: UnitTime;
  } {
    if (typeof input === 'number') {
      return { duration: input, unit: 'ms' };
    }

    const trimmed = input.trim().toLowerCase();

    // Pure number? Treat as milliseconds
    if (/^\d+$/.test(trimmed)) {
      return { duration: parseInt(trimmed, 10), unit: 'ms' };
    }

    // Match number (including decimals) and unit
    const match = trimmed.match(/^(\d*\.?\d+)\s*([a-z]+)$/);
    if (!match) {
      throw new AppError(
        `Invalid duration format: "${input}". Expected format: <number><unit> (e.g., "7d", "1.5h")`,
        HttpStatus.EXPECTATION_FAILED,
        this.context,
        {
          cause: `Provided format "${input}" is invalid, which can't be use for parsing time.`,
          description: `Invalid duration format "${input}". Please only use Number and list of supported units: ${Object.keys(ALIAS_MAP).join(', ')}`,
        },
      );
    }

    const [, numStr, alias] = match;
    const duration = parseFloat(numStr);
    const unit = this.normalizeUnit(alias);

    return { duration, unit };
  }

  /**
   * Resolve unit aliases to standardized UnitTime
   */
  private normalizeUnit(rawUnit: string): UnitTime {
    const unit = ALIAS_MAP[rawUnit];
    if (!unit) {
      // Handle ambiguous single 'm' unit
      if (Object.values<string>(AmbiguousUnit).includes(rawUnit)) {
        throw new AppError(
          `Ambiguous unit "${rawUnit}". Use 'min' for minutes or 'mo' for months.`,
          HttpStatus.EXPECTATION_FAILED,
          this.context,
          {
            cause: `Provide ambiguous unit "${rawUnit}", which can cause confusion.`,
            description: `Ambiguous unit: "${rawUnit}". List of supported units: ${Object.keys(ALIAS_MAP).join(', ')}`,
          },
        );
      }
      throw new AppError(
        `Unknown time unit: "${rawUnit}". Supported units: ${Object.keys(ALIAS_MAP).join(', ')}`,
        HttpStatus.EXPECTATION_FAILED,
        this.context,
        {
          cause: `Provide unknown unit "${rawUnit}", which can be use for parsing format.`,
          description: `Unknown time unit: "${rawUnit}". List of supported units: ${Object.keys(ALIAS_MAP).join(', ')}`,
        },
      );
    }

    return unit;
  }

  /**
   * Add duration of given unit to now.
   */
  private setExpiresAt(duration: number, unit: UnitTime): Date {
    const multiplier = UNIT_MULTIPLIERS[unit];

    // This check is good practice but technically redundant if UnitTime type is enforced
    if (multiplier === undefined) {
      throw new AppError(
        `Unsupported time format: "${unit}"`,
        HttpStatus.EXPECTATION_FAILED,
        this.context,
        {
          cause: `User provided invalid time fomat "${unit}"`,
          description: `Time format must match one of the following: ${Object.keys(UNIT_MULTIPLIERS).join(', ')}`,
        },
      );
    }

    return new Date(Date.now() + duration * multiplier);
  }

  // const config = Object.values(unitConfig).find((c) => c.unit === unit);
  // if (!config) {
  //   throw new Error(`Unsupported time unit: "${unit}"`);
  // }
  // return new Date(Date.now() + duration * config.multiplier);
}
