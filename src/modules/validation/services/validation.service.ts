// src/modules/validation/validation.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { HttpStatus } from '@nestjs/common';
import { AppError } from 'exceptions/app.exception';

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateEmail(email: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (exists) {
      throw new AppError('Email is already taken', HttpStatus.CONFLICT);
      // return {
      //   status: HttpStatus.CONFLICT,
      //   message: 'Email is already taken',
      // };
    }

    return {
      status: HttpStatus.OK,
      message: 'Email is available',
    };
  }

  async validateUsername(username: string) {
    const exists = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });

    if (exists) {
      throw new AppError('Username is already taken', HttpStatus.CONFLICT);
      // return {
      //   status: HttpStatus.CONFLICT,
      //   message: 'Username is already taken',
      // };
    }

    return {
      status: HttpStatus.OK,
      message: 'Username is available',
    };
  }

  async validateOfficialId(officialId: string) {
    // Format check (defense in depth — schema already checks this client-side)
    if (!/^\d{10}$/.test(officialId)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Official ID must be exactly 10 digits',
      };
    }

    const employee = await this.prisma.profile.findUnique({
      where: { officialId },
    });

    // ❌ Doesn't exist at all — not a valid employee ID
    if (!employee) {
      throw new NotFoundException('Official ID not found!');
      // return {
      //   status: HttpStatus.NOT_FOUND,
      //   message: 'No employee record found with this ID',
      // };
    }

    // ❌ Exists, but already linked to a different account
    if (employee.userId) {
      throw new ConflictException(
        'This ID is already linked to another account',
      );
      // return {
      //   status: HttpStatus.CONFLICT,
      //   message: 'This ID is already linked to another account',
      // };
    }

    // ✅ Exists AND unclaimed — this is the success case
    return {
      status: HttpStatus.OK,
      message: 'Official ID verified',
    };

    // const exists = await this.prisma.profile.findFirst({
    //   where: { officialId },
    //   select: { id: true },
    // });

    // if (!exists) {
    //   return {
    //     status: HttpStatus.NOT_FOUND,
    //     message: 'Official ID not found!',
    //   };
    // }

    // return {
    //   status: HttpStatus.OK,
    //   message: 'Official ID is available',
    // };
  }
}
