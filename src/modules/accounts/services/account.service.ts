import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppError } from 'exceptions/app.exception';
import { PrismaService } from 'modules/prisma/services/prisma.service';

// account.service.ts
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async linkEmployeeId(userId: number, officialId: string) {
    // 1. Validate format (10-digit number)
    if (!/^\d{10}$/.test(officialId)) {
      throw new AppError(
        'Official ID must be exactly 10 digits',
        HttpStatus.BAD_REQUEST,
        'AccountService',
      );
    }

    // 2. Find matching employee record
    const employee = await this.prisma.profile.findUnique({
      where: { officialId },
    });

    if (!employee) {
      throw new AppError(
        'No employee record found with this ID',
        HttpStatus.NOT_FOUND,
        'AccountService',
      );
    }

    // 3. Ensure it's not already claimed by someone else
    if (employee.userId && employee.userId !== userId) {
      throw new AppError(
        'This ID is already linked to another account',
        HttpStatus.CONFLICT,
        'AccountService',
      );
    }

    // 4. Link employee record to this user, mark user as linked
    await this.prisma.$transaction([
      this.prisma.profile.update({
        where: { officialId },
        data: { userId },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isLinked: true },
      }),
    ]);

    return {
      success: true,
      employee,
    };
  }
}
