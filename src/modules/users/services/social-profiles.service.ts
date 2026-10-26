import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/services/prisma.service';
import type {
  CreateSocialProfileDto,
  UpdateSocialProfileDto,
} from '../dto/social-profile.dto';

@Injectable()
export class SocialProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProvider(providerId: number) {
    const provider = await this.prisma.socialProvider.findUnique({
      where: { id: providerId, isEnabled: true },
      select: { id: true },
    });
    if (!provider)
      throw new NotFoundException('Enabled social provider not found');
  }

  private async requireUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }

  async list(userId: number) {
    await this.requireUser(userId);
    return this.prisma.userSocialProfile.findMany({
      where: { userId },
      include: { provider: true },
      orderBy: { id: 'asc' },
    });
  }

  async create(userId: number, data: CreateSocialProfileDto) {
    await this.requireUser(userId);
    await this.requireProvider(data.providerId);
    return this.mutate(() =>
      this.prisma.userSocialProfile.create({
        data: { ...data, userId },
        include: { provider: true },
      }),
    );
  }

  async update(userId: number, id: number, data: UpdateSocialProfileDto) {
    await this.requireUser(userId);
    if (data.providerId !== undefined)
      await this.requireProvider(data.providerId);
    return this.mutate(() =>
      this.prisma.userSocialProfile.update({
        where: { id, userId },
        data,
        include: { provider: true },
      }),
    );
  }

  async delete(userId: number, id: number) {
    await this.requireUser(userId);
    return this.mutate(() =>
      this.prisma.userSocialProfile.delete({
        where: { id, userId },
        include: { provider: true },
      }),
    );
  }

  private async mutate<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            'This social profile already exists for the user',
          );
        if (error.code === 'P2025' || error.code === 'P2003')
          throw new NotFoundException(
            'User, provider, or social profile not found',
          );
      }
      throw error;
    }
  }
}
