import { ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import type { SocialProfilesService } from '../services/social-profiles.service';
import { AccountSettingsController } from './account-settings.controller';

describe('AccountSettingsController', () => {
  const session = { user: { id: '42' } } as Parameters<
    AccountSettingsController['get']
  >[0];
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const updateLink = jest.fn();
  const prisma = {
    user: { findUnique },
    profile: { updateMany },
  } as unknown as PrismaService;
  const socialProfiles = {
    update: updateLink,
  } as unknown as SocialProfilesService;
  const controller = new AccountSettingsController(prisma, socialProfiles);

  beforeEach(() => {
    jest.resetAllMocks();
    findUnique.mockResolvedValue({
      isLinked: true,
      isEnabled: true,
      banned: false,
    });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('updates only the profile owned by the signed-in officer', async () => {
    await expect(
      controller.updatePhone(session, { phone: '+855 12345678' }),
    ).resolves.toEqual({ phone: '+855 12345678' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      data: { phone: '+855 12345678' },
    });
  });

  it('uses the signed-in owner when updating a social link', async () => {
    await controller.updateLink(session, 7, { handle: 'officer' });
    expect(updateLink).toHaveBeenCalledWith(42, 7, { handle: 'officer' });
  });

  it.each([
    { isLinked: false },
    { banned: true },
    { isEnabled: false },
    { isLocked: true },
  ])(
    'denies settings writes for an ineligible account with %j',
    async (restrictions) => {
      findUnique.mockResolvedValue({
        isLinked: true,
        isEnabled: true,
        banned: false,
        ...restrictions,
      });
      await expect(
        controller.updatePhone(session, { phone: null }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(updateMany).not.toHaveBeenCalled();
    },
  );
});
