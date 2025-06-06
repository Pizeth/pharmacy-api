// src/services/access-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import e, { Request } from 'express';
import { TokenPayload } from 'src/types/token';

@Injectable()
export class TokenService {
  private expiresIn;
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '900s';
  }

  private generatePayload(payload: TokenPayload, req: Request) {
    return {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role: payload.roleId,
      ip: req.ip,
    };
  }

  private generateToken(
    payload: { filename: string },
    expiresIn: string = this.expiresIn,
  ): string {
    try {
      return this.jwtService.sign(payload, { expiresIn });
    } catch (error: unknown) {
      throw new Error('Failed to generate token');
    }
  }

  verifyToken(token: string): { filename: string } {
    return this.jwtService.verify(token);
  }
}

EXPIRE_IN;
