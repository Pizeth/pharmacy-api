import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import {
  appActionSchema,
  appSubjectSchema,
} from 'modules/authorization/casl/app-ability';
import {
  ROLE_ICONS,
  protectedRole,
  type RoleInput,
  type RoleUpdate,
} from './roles.schemas';
const include = {
  permissions: {
    include: { permission: true },
    orderBy: { permissionId: 'asc' },
  },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof include }>;
export const supportedPermission = (permission: {
  action: string;
  subject: string;
}) =>
  appActionSchema.safeParse(permission.action).success &&
  appSubjectSchema.safeParse(permission.subject).success;
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}
  private async actor(db: Prisma.TransactionClient, userId: number) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        banned: true,
        isEnabled: true,
        isLocked: true,
        isActivated: true,
        deletedAt: true,
        userRole: { select: { name: true, isEnabled: true } },
      },
    });
    if (
      !user ||
      user.banned ||
      user.isEnabled === false ||
      user.isLocked ||
      user.isActivated === false ||
      user.deletedAt ||
      !user.userRole?.isEnabled ||
      user.userRole.name !== 'SUPER_ADMIN'
    )
      throw new ForbiddenException(
        'An active application super administrator is required to manage roles.',
      );
    return user;
  }
  private async read(db: Prisma.TransactionClient, id: number) {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new BadRequestException('Invalid role ID.');
    const row = await db.role.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Role not found.');
    return row;
  }
  private format(row: RoleRow) {
    return {
      ...row,
      permissions: row.permissions.map((item) => ({
        ...item.permission,
        supported: supportedPermission(item.permission),
      })),
      userCount: row._count.users,
      isProtected: protectedRole(row.name),
    };
  }
  async metadata(userId: number) {
    await this.actor(this.prisma, userId);
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
    return {
      canManage: true,
      permissions: permissions.map((permission) => ({
        ...permission,
        supported: supportedPermission(permission),
      })),
      icons: ROLE_ICONS.map((value) => ({
        value,
        label: value.replaceAll('-', ' '),
      })),
    };
  }
  async list(userId: number) {
    await this.actor(this.prisma, userId);
    return (
      await this.prisma.role.findMany({ orderBy: { name: 'asc' }, include })
    ).map((row) => this.format(row));
  }
  async get(userId: number, id: number) {
    await this.actor(this.prisma, userId);
    return this.format(await this.read(this.prisma, id));
  }
  private snapshot(row: RoleRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      isEnabled: row.isEnabled,
      version: row.objectVersionId,
      permissionIds: row.permissions.map((item) => item.permissionId),
    };
  }
  private async grants(
    db: Prisma.TransactionClient,
    ids: number[],
    before?: RoleRow,
  ) {
    const catalog = await db.permission.findMany({
      where: { id: { in: ids } },
    });
    if (catalog.length !== ids.length)
      throw new BadRequestException('A selected permission no longer exists.');
    const previous = new Set(
      before?.permissions.map((item) => item.permissionId),
    );
    if (
      catalog.some(
        (permission) =>
          !supportedPermission(permission) && !previous.has(permission.id),
      )
    )
      throw new BadRequestException(
        'Only permissions supported by the application policy can be newly granted.',
      );
  }
  private async audit(
    db: Prisma.TransactionClient,
    userId: number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    before: RoleRow | null,
    after: RoleRow | null,
    ipAddress: string,
  ) {
    await db.auditTrail.create({
      data: {
        userId,
        action,
        targetType: 'Role',
        targetId: String((after ?? before)!.id),
        ipAddress,
        description: action + ' application role ' + (after ?? before)!.name,
        ...(before ? { oldValues: this.snapshot(before) } : {}),
        ...(after ? { newValues: this.snapshot(after) } : {}),
      },
    });
  }
  private error(error: unknown): never {
    const code =
      error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'P2002')
      throw new ConflictException('A role with that name already exists.');
    if (code === 'P2003')
      throw new ConflictException(
        'This role is assigned to users and cannot be deleted. Reassign them first.',
      );
    throw error;
  }
  private fields(input: RoleInput) {
    return {
      name: input.name,
      description: input.description || null,
      icon: input.icon,
      color: input.color,
      isEnabled: input.isEnabled,
    };
  }
  async save(
    userId: number,
    input: RoleInput | RoleUpdate,
    id?: number,
    ipAddress = 'unknown',
  ) {
    try {
      return await this.prisma.$transaction(async (db) => {
        // Serialize role-management writes, then resolve current authority from the database.
        await db.$executeRaw`SELECT pg_advisory_xact_lock(734620, 1)`;
        await this.actor(db, userId);
        const before = id === undefined ? null : await this.read(db, id);
        if (
          protectedRole(input.name) &&
          (!before || before.name !== input.name)
        )
          throw new ConflictException('Bootstrap role names are reserved.');
        if (
          before &&
          protectedRole(before.name) &&
          (!input.isEnabled ||
            input.name !== before.name ||
            JSON.stringify([...input.permissionIds].sort((a, b) => a - b)) !==
              JSON.stringify(
                before.permissions
                  .map((item) => item.permissionId)
                  .sort((a, b) => a - b),
              ))
        )
          throw new ConflictException(
            'Bootstrap roles must retain their name, enabled state and permissions. Their display metadata may be edited.',
          );
        await this.grants(db, input.permissionIds, before ?? undefined);
        let roleId: number;
        if (before) {
          const version = 'version' in input ? input.version : 0;
          const claimed = await db.role.updateMany({
            where: { id: before.id, objectVersionId: version },
            data: {
              ...this.fields(input),
              updatedBy: userId,
              objectVersionId: { increment: 1 },
            },
          });
          if (claimed.count !== 1)
            throw new ConflictException({
              message:
                'This role changed. Close and reopen the form before saving.',
              code: 'ROLE_VERSION_CONFLICT',
            });
          roleId = before.id;
          await db.rolePermission.deleteMany({ where: { roleId } });
        } else {
          const row = await db.role.create({
            data: {
              ...this.fields(input),
              createdBy: userId,
              updatedBy: userId,
            },
          });
          roleId = row.id;
        }
        if (input.permissionIds.length)
          await db.rolePermission.createMany({
            data: input.permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
          });
        const after = await this.read(db, roleId);
        await this.audit(
          db,
          userId,
          before ? 'UPDATE' : 'CREATE',
          before,
          after,
          ipAddress,
        );
        return this.format(after);
      });
    } catch (error) {
      return this.error(error);
    }
  }
  async remove(
    userId: number,
    id: number,
    version: number,
    ipAddress = 'unknown',
  ) {
    try {
      return await this.prisma.$transaction(async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(734620, 1)`;
        await this.actor(db, userId);
        const before = await this.read(db, id);
        if (protectedRole(before.name))
          throw new ConflictException('Bootstrap roles cannot be deleted.');
        if (before._count.users)
          throw new ConflictException(
            'This role is assigned to users and cannot be deleted. Reassign them first.',
          );
        const deleted = await db.role.deleteMany({
          where: { id, objectVersionId: version },
        });
        if (deleted.count !== 1)
          throw new ConflictException({
            message:
              'This role changed. Close and reopen the form before deleting.',
            code: 'ROLE_VERSION_CONFLICT',
          });
        await this.audit(db, userId, 'DELETE', before, null, ipAddress);
        return this.format(before);
      });
    } catch (error) {
      return this.error(error);
    }
  }
}
