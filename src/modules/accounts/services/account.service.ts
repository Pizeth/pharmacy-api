import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppError } from 'exceptions/app.exception';
import { isTelegramPlaceholderEmail } from 'lib/auth.telegram.js';
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        email: true,
        emailVerified: true,
        isLinked: true,
        accounts: {
          where: { providerId: 'telegram' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new AppError(
        'Account not found',
        HttpStatus.NOT_FOUND,
        'AccountService',
      );
    }
    if (
      !user.isLinked &&
      user.accounts.length > 0 &&
      (!user.emailVerified || isTelegramPlaceholderEmail(user.email))
    ) {
      throw new AppError(
        'Verify a valid email address before linking your officer ID.',
        HttpStatus.FORBIDDEN,
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
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.profile.updateMany({
        where: { officialId, OR: [{ userId: null }, { userId }] },
        data: { userId },
      });
      if (claim.count !== 1) {
        throw new AppError(
          'This ID is already linked to another account',
          HttpStatus.CONFLICT,
          'AccountService',
        );
      }
      await tx.user.update({
        where: { id: userId },
        data: { isLinked: true },
      });
    });

    return {
      success: true,
      employee,
    };
  }
}
