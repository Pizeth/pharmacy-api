// src/services/access-token.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(
    payload: { filename: string },
    expiresIn: string = '1h',
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
