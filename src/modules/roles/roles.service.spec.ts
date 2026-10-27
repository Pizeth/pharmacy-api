import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import { RolesService, supportedPermission } from './roles.service';
import { roleInputSchema, type RoleInput } from './roles.schemas';
const mock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const row = (changes = {}) => ({
  id: 5,
  name: 'EDITOR',
  description: 'Editor',
  icon: null,
  color: null,
  isEnabled: true,
  objectVersionId: 2,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  permissions: [],
  _count: { users: 0 },
  ...changes,
});
const input: RoleInput = {
  name: 'EDITOR',
  description: 'Editor',
  icon: null,
  color: null,
  isEnabled: true,
  permissionIds: [],
};
function setup(
  actor = {
    id: 1,
    isEnabled: true,
    isActivated: true,
    userRole: { name: 'SUPER_ADMIN', isEnabled: true },
  },
) {
  const db = {
    $executeRaw: mock().mockResolvedValue(1),
    user: { findUnique: mock().mockResolvedValue(actor) },
    role: {
      findUnique: mock().mockResolvedValue(row()),
      findMany: mock().mockResolvedValue([row()]),
      create: mock().mockResolvedValue(row()),
      updateMany: mock().mockResolvedValue({ count: 1 }),
      deleteMany: mock().mockResolvedValue({ count: 1 }),
    },
    permission: { findMany: mock().mockResolvedValue([]) },
    rolePermission: {
      deleteMany: mock().mockResolvedValue({ count: 0 }),
      createMany: mock().mockResolvedValue({ count: 0 }),
    },
    auditTrail: { create: mock().mockResolvedValue({}) },
  };
  const prisma = {
    ...db,
    $transaction: async (run: (value: typeof db) => Promise<unknown>) =>
      run(db),
  };
  return { db, service: new RolesService(prisma as unknown as PrismaService) };
}
it('requires the application SUPER_ADMIN role, not Better Auth admin claims', async () => {
  const { service, db } = setup({
    id: 1,
    isEnabled: true,
    isActivated: true,
    userRole: { name: 'ADMIN', isEnabled: true },
  });
  await expect(service.save(1, input)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(db.role.create).not.toHaveBeenCalled();
});
it.each(['isEnabled', 'isActivated'])(
  'rejects an explicitly false account %s flag',
  async (flag) => {
    const { service } = setup({
      id: 1,
      isEnabled: true,
      isActivated: true,
      userRole: { name: 'SUPER_ADMIN', isEnabled: true },
      [flag]: false,
    });
    await expect(service.list(1)).rejects.toBeInstanceOf(ForbiddenException);
  },
);
it('rejects a disabled application role', async () => {
  const { service } = setup({
    id: 1,
    isEnabled: true,
    isActivated: true,
    userRole: { name: 'SUPER_ADMIN', isEnabled: false },
  });
  await expect(service.metadata(1)).rejects.toBeInstanceOf(ForbiddenException);
});
it('creates roles and audits grant changes in the transaction', async () => {
  const { service, db } = setup();
  await service.save(1, input, undefined, '127.0.0.1');
  expect(db.role.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      name: 'EDITOR',
      createdBy: 1,
      updatedBy: 1,
    }),
  });
  expect(db.auditTrail.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'CREATE',
      targetType: 'Role',
      userId: 1,
      newValues: expect.objectContaining({ permissionIds: [] }),
    }),
  });
});
it('rejects an unknown selected permission before role writes', async () => {
  const { service, db } = setup();
  await expect(
    service.save(1, { ...input, permissionIds: [999] }),
  ).rejects.toThrow('no longer exists');
  expect(db.role.create).not.toHaveBeenCalled();
});
it('rejects newly granting permissions the CASL policy does not evaluate', async () => {
  const { service, db } = setup();
  db.permission.findMany.mockResolvedValue([
    { id: 1, action: 'fly', subject: 'Secret' },
  ]);
  await expect(
    service.save(1, { ...input, permissionIds: [1] }),
  ).rejects.toThrow('supported by the application policy');
  expect(db.role.create).not.toHaveBeenCalled();
});
it('preserves previously assigned legacy permissions during metadata edits', async () => {
  const { service, db } = setup();
  const permission = { id: 1, action: 'fly', subject: 'Secret' };
  db.role.findUnique.mockResolvedValue(
    row({ permissions: [{ roleId: 5, permissionId: 1, permission }] }),
  );
  db.permission.findMany.mockResolvedValue([permission]);
  await service.save(1, { ...input, permissionIds: [1], version: 2 }, 5);
  expect(db.rolePermission.createMany).toHaveBeenCalledWith({
    data: [{ roleId: 5, permissionId: 1 }],
  });
});
it('does not replace grants or audit a stale update', async () => {
  const { service, db } = setup();
  db.role.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    service.save(1, { ...input, version: 1 }, 5),
  ).rejects.toMatchObject({ response: { code: 'ROLE_VERSION_CONFLICT' } });
  expect(db.rolePermission.deleteMany).not.toHaveBeenCalled();
  expect(db.auditTrail.create).not.toHaveBeenCalled();
});
it('does not delete an assigned role', async () => {
  const { service, db } = setup();
  db.role.findUnique.mockResolvedValue(row({ _count: { users: 2 } }));
  await expect(service.remove(1, 5, 2)).rejects.toThrow('assigned to users');
  expect(db.role.deleteMany).not.toHaveBeenCalled();
});
it('protects bootstrap role deletion, disabling, renaming and grant replacement', async () => {
  const { service, db } = setup();
  db.role.findUnique.mockResolvedValue(row({ name: 'SUPER_ADMIN' }));
  await expect(service.remove(1, 5, 2)).rejects.toThrow('cannot be deleted');
  await expect(
    service.save(
      1,
      { ...input, name: 'SUPER_ADMIN', isEnabled: false, version: 2 },
      5,
    ),
  ).rejects.toThrow('retain their name');
  await expect(service.save(1, { ...input, version: 2 }, 5)).rejects.toThrow(
    'retain their name',
  );
  await expect(
    service.save(
      1,
      { ...input, name: 'SUPER_ADMIN', permissionIds: [1], version: 2 },
      5,
    ),
  ).rejects.toThrow('retain their name');
  expect(db.role.updateMany).not.toHaveBeenCalled();
});
it('allows bootstrap display metadata edits', async () => {
  const { service, db } = setup();
  db.role.findUnique.mockResolvedValue(row({ name: 'SUPER_ADMIN' }));
  await service.save(
    1,
    { ...input, name: 'SUPER_ADMIN', color: '#1565c0', version: 2 },
    5,
  );
  expect(db.role.updateMany).toHaveBeenCalled();
});
it('rejects creating reserved bootstrap identities', async () => {
  const { service } = setup();
  await expect(
    service.save(1, { ...input, name: 'SUPER_ADMIN' }),
  ).rejects.toThrow('reserved');
});
it('maps concurrent foreign-key and duplicate-name conflicts', async () => {
  const { service, db } = setup();
  db.role.deleteMany.mockRejectedValue({ code: 'P2003' });
  await expect(service.remove(1, 5, 2)).rejects.toBeInstanceOf(
    ConflictException,
  );
  db.role.create.mockRejectedValue({ code: 'P2002' });
  await expect(service.save(1, input)).rejects.toThrow('already exists');
});
it('deletes only the expected version and retains an audit snapshot', async () => {
  const { service, db } = setup();
  await service.remove(1, 5, 2);
  expect(db.role.deleteMany).toHaveBeenCalledWith({
    where: { id: 5, objectVersionId: 2 },
  });
  expect(db.auditTrail.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'DELETE',
      oldValues: expect.objectContaining({ name: 'EDITOR', version: 2 }),
    }),
  });
});
it('normalizes role names and rejects unsafe display metadata and duplicate grants', () => {
  expect(
    roleInputSchema.parse({ ...input, name: 'document-editor' }).name,
  ).toBe('DOCUMENT_EDITOR');
  expect(
    roleInputSchema.safeParse({ ...input, color: 'url(unsafe)' }).success,
  ).toBe(false);
  expect(roleInputSchema.safeParse({ ...input, icon: 'unknown' }).success).toBe(
    false,
  );
  expect(
    roleInputSchema.safeParse({ ...input, permissionIds: [1, 1] }).success,
  ).toBe(false);
  expect(
    roleInputSchema.safeParse({ ...input, isSuperAdmin: true }).success,
  ).toBe(false);
  expect(
    supportedPermission({ action: 'read', subject: 'TranslationKey' }),
  ).toBe(true);
});
