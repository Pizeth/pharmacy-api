// src/modules/validation/validation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateEmail(email: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (exists) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Email is already taken',
      };
    }

    return {
      status: HttpStatus.OK,
      message: 'Email is available',
    };
  }

  async validateUsername(username: string) {
    const exists = await this.prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });

    if (exists) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Username is already taken',
      };
    }

    return {
      status: HttpStatus.OK,
      message: 'Username is available',
    };
  }
}
