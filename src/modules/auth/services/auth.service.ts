import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { LoginStatus } from 'generated/prisma/client';
import { ClsService } from 'nestjs-cls';
import { AppError } from 'exceptions/app.exception';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class AuthService {
  private readonly context = AuthService.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  // Called from Better Auth's before hooks to enforce your custom flags
  async assertUserCanLogin(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        banned: true, // admin() plugin field
      },
    });

    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, this.context);
    }

    if (!user.isEnabled || user.banned) {
      throw new AppError(
        'Account is banned or inactive',
        HttpStatus.FORBIDDEN,
        this.context,
        'User is banned or disabled',
      );
    }

    if (user.isLocked) {
      throw new AppError(
        'Account is locked',
        HttpStatus.FORBIDDEN,
        this.context,
        'User account is locked due to multiple failed attempts',
      );
    }

    if (!user.isActivated) {
      throw new AppError(
        'Account is not activated',
        HttpStatus.FORBIDDEN,
        this.context,
        'User has not activated their account',
      );
    }
  }

  async getUserByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        banned: true,
      },
    });
  }

  async recordLoginAttempt(
    userId: number | null,
    username: string,
    status: LoginStatus,
    reason: string | null = null,
  ): Promise<void> {
    try {
      const userAgent = new UAParser(this.cls.get('userAgent'));
      await this.prisma.loginAttempt.create({
        data: {
          userId,
          username,
          ipAddress: this.cls.get<string>('ipAddress'),
          status,
          reason,
          locale: this.cls.get<string>('acceptLanguage'),
          referer: this.cls.get<string>('referer'),
          userAgent: JSON.stringify(userAgent.getResult()),
        },
      });
    } catch (error) {
      // Non-fatal — log but don't throw, login should still proceed
      this.logger.error('Error recording login attempt:', error);
    }
  }
}
