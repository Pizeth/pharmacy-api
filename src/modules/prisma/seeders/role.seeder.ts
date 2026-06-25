import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import data from '../data/roles.json';
import { Prisma, Role } from 'generated/prisma/client';
import { AppError } from 'exceptions/app.exception';

@Injectable()
export class RoleSeeder {
  private readonly context = RoleSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`PrismaService injected: ${!!prisma}`);
  }

  async seed(tx?: Prisma.TransactionClient): Promise<Role[]> {
    this.logger.log(
      '🌱 Seeding database structures from internal matrix roles configuration JSON payload...',
    );
    const prismaClient = tx || this.prisma; // Use the provided tx or the default client
    const roles = this.getRolesFromData();
    try {
      for (const roleData of roles) {
        await prismaClient.role.upsert({
          where: { name: roleData.name },
          update: {},
          create: roleData,
        });
      }

      this.logger.log(
        `✅ Structural initialization verification finished: mapped ${roles.length} core roles.`,
      );

      return await prismaClient.role.findMany({
        where: { isEnabled: true },
      });
    } catch (error) {
      this.logger.error(
        'CRITICAL: Role structural initialization operation broken',
        error,
      );
      throw new AppError(
        'Failed to seed roles',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  private getRolesFromData() {
    return data.roles.map((role) => ({
      name: role.name,
      description: role.description,
      createdBy: Number(role.createdBy) || 1,
      updatedBy: Number(role.updatedBy) || 1,
    }));
  }
}
