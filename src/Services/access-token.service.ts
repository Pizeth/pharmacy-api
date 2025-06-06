// src/services/access-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import { RefreshToken } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenPayload } from 'src/types/token';
import { AppError } from 'src/middlewares/app-errors.middleware';
import statusCode from 'http-status-codes';

@Injectable()
export class TokenService {
  private expiresIn;
  private secretKey;
  private refreshTokenKey;
  private expireRefresh;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService, // Replace with actual Prisma client type
    private readonly jwtService: JwtService,
  ) {
    this.expiresIn = this.config.get<string>('EXPIRES_IN') || '900s';
    this.secretKey = this.config.get<string>('SECRET_KEY') || '270400';
    this.refreshTokenKey =
      this.config.get<string>('REFRESH_TOKEN_KEY') || '200794';
    this.expireRefresh = this.config.get<string>('EXPIRE_REFRESH') || '7d';
  }

  generatePayload(payload: TokenPayload, req: Request) {
    return {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role: payload.roleId,
      ip: req.ip,
    };
  }

  // Generate access token
  generateToken(
    payload: TokenPayload | { filename: string },
    expiresIn: string = this.expiresIn,
  ): string {
    try {
      return this.jwtService.sign(payload, {
        expiresIn,
        secret: this.secretKey,
      });
    } catch (error: unknown) {
      throw new Error('Failed to generate token');
    }
  }

  // Generate refresh tokens
  async generateRefreshToken(payload: TokenPayload): Promise<RefreshToken> {
    // const token = jwt.sign(payload, refreshTokenKey, { expiresIn: "7d" });
    const token = this.generateToken(payload, this.expireRefresh);
    try {
      return await this.createRefreshToken(token, payload.id);
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  }

  verifyToken(token: string): TokenPayload {
    return this.jwtService.verify(token, {
      secret: this.refreshTokenKey,
    });
  }

  // Verify the access token
  verifyTokenClaims(token: string, req: Request): TokenPayload {
    try {
      // Verify the token with your secret key
      const verifiedToken = this.jwtService.verify<TokenPayload>(token, {
        secret: this.secretKey,
        algorithms: ['HS256'], // Specify allowed algorithms
        // Optional: add additional verification options
        complete: false, // Returns the decoded payload
      });

      // Define required claims
      const requiredClaims = ['id', 'username', 'email', 'roleId', 'ip'];

      // Check for undefined or null claims
      const invalidClaims = requiredClaims.filter(
        (claim) =>
          verifiedToken[claim as keyof TokenPayload] === undefined ||
          verifiedToken[claim as keyof TokenPayload] === null ||
          verifiedToken[claim as keyof TokenPayload] === '',
      );

      // If any required claims are invalid, throw an error
      if (invalidClaims.length > 0) {
        throw new Error(
          `Invalid token: Undefined or null claims - ${invalidClaims.join(
            ', ',
          )}`,
        );
      }

      return verifiedToken;
    } catch (error: unknown) {
      if (error instanceof JsonWebTokenError) {
        // Signature verification failed
        console.error('JWT Signature Verification Failed', {
          error: error.message,
          ip: req.ip, // Assuming you have a method to get current IP
        });
        // throw new Error("Authentication failed: Invalid token signature");
        throw new AppError(
          'Authentication failed: Invalid token signature',
          statusCode.UNAUTHORIZED,
          error,
        );
      }
      // Handle different types of JWT verification errors
      if (error.name === 'JsonWebTokenError') {
        // Signature verification failed
        console.error('JWT Signature Verification Failed', {
          error: error.message,
          ip: req.ip, // Assuming you have a method to get current IP
        });
        // throw new Error("Authentication failed: Invalid token signature");
        throw new AppError(
          'Authentication failed: Invalid token signature',
          statusCode.UNAUTHORIZED,
          error,
        );

        // // Log the error for security monitoring
        // this.logger.security("Token verification failed", {
        //   error: error.message,
        //   tokenDetails: this.sanitizeTokenForLogging(decodedToken),
        // });

        // // Throw a generic error to prevent information leakage
        // throw new Error("Authentication failed");
      }

      if (error.name === 'TokenExpiredError') {
        console.error('JWT Token Expired', {
          error: error.message,
          ip: req.ip,
        });
        throw new AppError(
          'Authentication failed: Token has expired',
          statusCode.UNAUTHORIZED,
          error,
        );
        // throw new Error("Authentication failed: Token has expired");
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Check if refresh token exists in database
  async findToken(token: string): Promise<RefreshToken | null> {
    try {
      return await this.prisma.refreshToken.findUnique({
        where: { token: token },
        include: { user: true },
      });
    } catch (error) {
      console.error('Error fetching refresh token:', error);
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
