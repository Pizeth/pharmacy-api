import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/services/prisma.service';
import { SocialProfilesService } from './social-profiles.service';
import {
  createSocialProfileSchema,
  updateSocialProfileSchema,
} from '../dto/social-profile.dto';

describe('SocialProfilesService', () => {
  const prisma = {
    user: { findUnique: jest.fn<() => Promise<unknown>>() },
    socialProvider: { findUnique: jest.fn<() => Promise<unknown>>() },
    userSocialProfile: {
      create: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
      delete: jest.fn<() => Promise<unknown>>(),
      findMany: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new SocialProfilesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    prisma.socialProvider.findUnique.mockResolvedValue({ id: 2 });
  });

  it('validates provider IDs and rejects empty handles, unsafe URLs, and empty updates', () => {
    expect(
      createSocialProfileSchema.parse({
        providerId: 2,
        handle: ' alice ',
      }),
    ).toEqual({ providerId: 2, handle: 'alice' });
    expect(
      createSocialProfileSchema.safeParse({ providerId: 2, handle: ' ' })
        .success,
    ).toBe(false);
    expect(
      createSocialProfileSchema.safeParse({
        providerId: 2,
        handle: 'alice',
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(updateSocialProfileSchema.safeParse({}).success).toBe(false);
    expect(updateSocialProfileSchema.parse({ url: null })).toEqual({
      url: null,
    });
  });

  it('scopes updates and deletes to the specified user', async () => {
    await service.update(1, 9, { handle: 'new' });
    expect(prisma.userSocialProfile.update).toHaveBeenCalledWith({
      where: { id: 9, userId: 1 },
      data: { handle: 'new' },
      include: { provider: true },
    });
    await service.delete(1, 9);
    expect(prisma.userSocialProfile.delete).toHaveBeenCalledWith({
      where: { id: 9, userId: 1 },
      include: { provider: true },
    });
  });

  it('rejects missing users before creating profiles', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.create(1, { providerId: 2, handle: 'alice' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userSocialProfile.create).not.toHaveBeenCalled();
  });

  it('rejects missing or disabled providers before creating or reassigning profiles', async () => {
    prisma.socialProvider.findUnique.mockResolvedValue(null);
    await expect(
      service.create(1, { providerId: 2, handle: 'alice' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update(1, 9, { providerId: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.socialProvider.findUnique).toHaveBeenCalledWith({
      where: { id: 2, isEnabled: true },
      select: { id: true },
    });
    expect(prisma.userSocialProfile.create).not.toHaveBeenCalled();
    expect(prisma.userSocialProfile.update).not.toHaveBeenCalled();
  });

  it('returns conflicts for duplicates and not found for mismatched profile ownership', async () => {
    const error = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('test', {
        code,
        clientVersion: '7',
      });
    prisma.userSocialProfile.create.mockRejectedValue(error('P2002'));
    await expect(
      service.create(1, { providerId: 2, handle: 'alice' }),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.userSocialProfile.update.mockRejectedValue(error('P2025'));
    await expect(
      service.update(1, 9, { handle: 'new' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
