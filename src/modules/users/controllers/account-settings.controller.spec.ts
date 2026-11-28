import { ConflictException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { R2Service } from 'modules/files/services/cloudflare-r2.service';
import { type } from 'types/commons.enum';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import type { SocialProfilesService } from '../services/social-profiles.service';
jest.unstable_mockModule('@nestjs/throttler', () => ({
  Throttle: () => () => undefined,
}));
jest.unstable_mockModule('@nestjs/platform-express', () => ({
  FileInterceptor: () => jest.fn(),
}));
const { AccountSettingsController } =
  await import('./account-settings.controller');

describe('AccountSettingsController', () => {
  const session = { user: { id: '42' } } as Parameters<
    InstanceType<typeof AccountSettingsController>['get']
  >[0];
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const updateUser = jest.fn();
  const uploadFile = jest.fn();
  const deleteFile = jest.fn();
  const updateMany = jest.fn();
  const updateLink = jest.fn();
  const prisma = {
    user: { findUnique, findFirst, updateMany: updateUser },
    profile: { updateMany },
  } as unknown as PrismaService;
  const socialProfiles = {
    update: updateLink,
  } as unknown as SocialProfilesService;
  const controller = new AccountSettingsController(prisma, socialProfiles, {
    uploadFile,
    deleteFile,
  } as unknown as R2Service);

  beforeEach(() => {
    jest.resetAllMocks();
    findUnique.mockResolvedValue({
      isLinked: true,
      isEnabled: true,
      banned: false,
    });
    updateMany.mockResolvedValue({ count: 1 });
  });

  const avatar = {} as Express.Multer.File;
  const image = 'https://example.test/avatars/photo';

  it('persists the uploaded avatar on the eligible session owner', async () => {
    findFirst.mockResolvedValue({ id: 42, image: null });
    uploadFile.mockResolvedValue({
      type: type.Upload,
      status: 201,
      url: image,
      fileName: 'photo',
    });
    updateUser.mockResolvedValue({ count: 1 });

    await expect(controller.uploadAvatar(session, avatar)).resolves.toEqual({
      image,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 42,
          emailVerified: true,
          deletedAt: null,
        }),
      }),
    );
    expect(updateUser).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 42,
        image: null,
        emailVerified: true,
      }),
      data: { image },
    });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects an ineligible account before uploading', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      controller.uploadAvatar(session, avatar),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it.each([
    ['https://provider.example/avatar.png', undefined],
    [
      'https://bucket.example/avatars/99/12345678-1234-1234-1234-123456789abc',
      undefined,
    ],
    [
      'https://bucket.example/avatars/42/12345678-1234-1234-1234-123456789abc',
      'avatars/42/12345678-1234-1234-1234-123456789abc',
    ],
  ])(
    'replaces %s and cleans up only an avatar owned by the account',
    async (previous, oldKey) => {
      const key = 'avatars/42/98765432-1234-1234-1234-123456789abc';
      const url = `https://bucket.example/${key}`;
      findFirst.mockResolvedValue({ id: 42, image: previous });
      uploadFile.mockResolvedValue({
        type: type.Upload,
        status: 201,
        url,
        fileName: key,
      });
      updateUser.mockResolvedValue({ count: 1 });
      deleteFile.mockResolvedValue({ status: 200 });

      await expect(controller.uploadAvatar(session, avatar)).resolves.toEqual({
        image: url,
      });
      expect(updateUser).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 42, image: previous }),
        data: { image: url },
      });
      if (oldKey) expect(deleteFile).toHaveBeenCalledWith(oldKey);
      else expect(deleteFile).not.toHaveBeenCalled();
    },
  );

  it('removes an uploaded avatar when another request changes the account', async () => {
    findFirst.mockResolvedValue({ id: 42, image: null });
    uploadFile.mockResolvedValue({
      type: type.Upload,
      status: 201,
      url: image,
      fileName: 'photo',
    });
    updateUser.mockResolvedValue({ count: 0 });
    deleteFile.mockResolvedValue({ status: 200 });
    await expect(
      controller.uploadAvatar(session, avatar),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(deleteFile).toHaveBeenCalledWith('photo');
  });

  it('preserves an uploaded object when the database outcome is unknown', async () => {
    const error = new Error('Database acknowledgement lost');
    findFirst.mockResolvedValue({ id: 42, image: null });
    uploadFile.mockResolvedValue({
      type: type.Upload,
      status: 201,
      url: image,
      fileName: 'photo',
    });
    updateUser.mockRejectedValue(error);

    await expect(controller.uploadAvatar(session, avatar)).rejects.toBe(error);
    expect(deleteFile).not.toHaveBeenCalled();
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
    await controller.updateLink(session, {
      id: 7,
      changes: { handle: 'officer' },
    });
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
