import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/services/prisma.service';
import { SocialProvidersService } from './social-providers.service';
import {
  createSocialProviderSchema,
  updateSocialProviderSchema,
} from '../dto/social-provider.dto';

describe('SocialProvidersService', () => {
  const prisma = {
    socialProvider: {
      create: jest.fn<() => Promise<unknown>>(),
      delete: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new SocialProvidersService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => jest.resetAllMocks());

  it('normalizes keys and supports customization while rejecting unsafe URLs and empty edits', () => {
    expect(
      createSocialProviderSchema.parse({
        key: ' Telegram ',
        name: ' Telegram ',
      }),
    ).toEqual({ key: 'telegram', name: 'Telegram' });
    expect(
      createSocialProviderSchema.safeParse({
        key: 'telegram',
        name: 'Telegram',
        websiteUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(updateSocialProviderSchema.safeParse({}).success).toBe(false);
    expect(
      updateSocialProviderSchema.parse({ isEnabled: false, icon: null }),
    ).toEqual({ isEnabled: false, icon: null });
  });

  it('returns a conflict when deleting a referenced provider', async () => {
    prisma.socialProvider.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('test', {
        code: 'P2003',
        clientVersion: '7',
      }),
    );
    await expect(service.delete(2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns conflicts for duplicate keys and not found for missing providers', async () => {
    prisma.socialProvider.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('test', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    await expect(
      service.create({ key: 'telegram', name: 'Telegram' }),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.socialProvider.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('test', {
        code: 'P2025',
        clientVersion: '7',
      }),
    );
    await expect(service.update(2, { name: 'Custom' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
