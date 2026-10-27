/** Exercises role authorization and CASL grant changes against the real DB; all sample data rolls back. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { PrismaService } from '../src/modules/prisma/services/prisma.service';
import { RolesService } from '../src/modules/roles/roles.service';
import { CaslAbilityFactory } from '../src/modules/authorization/casl/casl-ability.factory';
const prisma = new PrismaService();
const rollback = new Error('ROLLBACK_ROLE_SMOKE_TEST');
const before = {
  roles: await prisma.role.count(),
  links: await prisma.rolePermission.count(),
  audit: await prisma.auditTrail.count(),
};
try {
  await prisma.$transaction(
    async (tx) => {
      const adapter = new Proxy(prisma, {
        get: (_target, key) =>
          key === '$transaction'
            ? async (run: (db: typeof tx) => Promise<unknown>) => run(tx)
            : Reflect.get(tx, key),
      });
      const service = new RolesService(adapter),
        factory = new CaslAbilityFactory(adapter);
      const admin = await tx.user.findFirst({
        where: {
          userRole: { name: 'SUPER_ADMIN', isEnabled: true },
          isEnabled: { not: false },
          isActivated: { not: false },
          isLocked: { not: true },
          deletedAt: null,
        },
        select: { id: true, roleId: true },
      });
      assert(admin, 'No active application SUPER_ADMIN account exists.');
      const metadata = await service.metadata(admin.id);
      assert(metadata.canManage);
      const permission = await tx.permission.upsert({
        where: {
          action_subject: { action: 'read', subject: 'TranslationKey' },
        },
        create: { action: 'read', subject: 'TranslationKey' },
        update: {},
      });
      const input = {
        name: 'SMOKE_ROLE_' + randomUUID().slice(0, 8).toUpperCase(),
        description: 'Rollback-only role verification',
        icon: 'shield' as const,
        color: '#1565c0',
        isEnabled: true,
        permissionIds: [permission.id],
      };
      let role = await service.save(admin.id, input);
      assert.equal(role.objectVersionId, 1);
      assert.equal(role.permissions[0].id, permission.id);
      const user = await tx.user.create({
        data: {
          name: 'Temporary role smoke user',
          email: randomUUID() + '@example.invalid',
          role: 'admin',
          roleId: role.id,
          isEnabled: true,
          isLocked: false,
          isActivated: true,
          banned: false,
        },
      });
      await assert.rejects(() => service.list(user.id), /super administrator/);
      assert(
        (await factory.createForUser(user.id)).can('read', 'TranslationKey'),
      );
      role = await service.save(
        admin.id,
        { ...input, permissionIds: [], version: role.objectVersionId },
        role.id,
      );
      assert.equal(role.objectVersionId, 2);
      assert(
        !(await factory.createForUser(user.id)).can('read', 'TranslationKey'),
      );
      const auditAfterUpdate = await tx.auditTrail.count();
      await assert.rejects(
        () => service.save(admin.id, { ...input, version: 1 }, role.id),
        /changed/,
      );
      assert.equal(await tx.auditTrail.count(), auditAfterUpdate);
      await assert.rejects(
        () => service.remove(admin.id, role.id, role.objectVersionId),
        /assigned to users/,
      );
      await assert.rejects(
        () => service.remove(admin.id, admin.roleId!, 1),
        /Bootstrap roles/,
      );
      role = await service.save(
        admin.id,
        { ...input, isEnabled: false, version: role.objectVersionId },
        role.id,
      );
      assert(
        !(await factory.createForUser(user.id)).can('read', 'TranslationKey'),
      );
      role = await service.save(
        admin.id,
        { ...input, version: role.objectVersionId },
        role.id,
      );
      assert(
        (await factory.createForUser(user.id)).can('read', 'TranslationKey'),
      );
      assert.equal(
        (
          await tx.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { role: true },
          })
        ).role,
        'admin',
      );
      await tx.user.update({ where: { id: user.id }, data: { roleId: null } });
      await service.remove(admin.id, role.id, role.objectVersionId);
      assert.equal(
        await tx.rolePermission.count({ where: { roleId: role.id } }),
        0,
      );
      const audit = await tx.auditTrail.findMany({
        where: { targetType: 'Role', targetId: String(role.id) },
      });
      assert(audit.some((item) => item.action === 'CREATE'));
      assert(audit.some((item) => item.action === 'UPDATE'));
      assert(audit.some((item) => item.action === 'DELETE'));
      console.log(
        'PASS: application-super-admin gate, real grants/CASL refresh, disabled roles, assigned-role protection, stale versions, protected bootstrap and audited CRUD.',
      );
      throw rollback;
    },
    { timeout: 120000, maxWait: 15000 },
  );
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}
const verify = new PrismaService();
try {
  assert.deepEqual(
    {
      roles: await verify.role.count(),
      links: await verify.rolePermission.count(),
      audit: await verify.auditTrail.count(),
    },
    before,
  );
  console.log(
    'PASS: all role, permission-link, audit and sample-user changes rolled back.',
  );
} finally {
  await verify.$disconnect();
}
