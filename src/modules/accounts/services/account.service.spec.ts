import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import { AccountService } from './account.service';

it('registers AccountService with Nest dependency injection', async () => {
  const module = await Test.createTestingModule({ providers: [AccountService] })
    .useMocker(() => ({}))
    .compile();
  expect(module.get(AccountService)).toBeDefined();
  await module.close();
});

describe('officer ID verification', () => {
  const findUser = jest.fn<() => Promise<object | null>>();
  const findProfile = jest.fn<() => Promise<object | null>>();
  const updateProfile = jest.fn<() => Promise<{ count: number }>>();
  const updateUser = jest.fn<() => Promise<void>>();
  const transaction = jest.fn(async (work: (tx: object) => Promise<void>) =>
    work({
      profile: { updateMany: updateProfile },
      user: { update: updateUser },
    }),
  );
  const service = new AccountService({
    user: { findUnique: findUser },
    profile: { findUnique: findProfile },
    $transaction: transaction,
  } as unknown as PrismaService);
  const telegramUser = { isLinked: false, accounts: [{ id: 'telegram' }] };

  beforeEach(() => {
    jest.clearAllMocks();
    findProfile.mockResolvedValue({ userId: null });
    updateProfile.mockResolvedValue({ count: 1 });
  });

  it.each([
    { email: 'subject@telegram.placeholder.invalid', emailVerified: true },
    { email: 'officer@example.test', emailVerified: false },
  ])(
    'requires a verified real email before a Telegram officer claim',
    async (email) => {
      findUser.mockResolvedValue({ ...telegramUser, ...email });
      await expect(service.linkEmployeeId(42, '1234567890')).rejects.toThrow(
        'Verify a valid email',
      );
      expect(findProfile).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('links an available officer profile for a verified Telegram user', async () => {
    findUser.mockResolvedValue({
      ...telegramUser,
      email: 'officer@example.test',
      emailVerified: true,
    });
    await expect(
      service.linkEmployeeId(42, '1234567890'),
    ).resolves.toMatchObject({ success: true });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isLinked: true },
    });
  });

  it('rejects the claim if the profile is no longer available at write time', async () => {
    findUser.mockResolvedValue({
      ...telegramUser,
      email: 'officer@example.test',
      emailVerified: true,
    });
    updateProfile.mockResolvedValue({ count: 0 });
    await expect(service.linkEmployeeId(42, '1234567890')).rejects.toThrow(
      'already linked',
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});
