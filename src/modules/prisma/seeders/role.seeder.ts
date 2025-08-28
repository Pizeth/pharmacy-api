import { HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import data from '../data/roles.json';
import { Role } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';

// @Injectable()
export class RoleSeeder {
  private readonly context = RoleSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(private readonly prisma: PrismaService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`PrismaService injected: ${!!prisma}`);
  }

  async seed(): Promise<Role[]> {
    this.logger.log('🌱 Seeding roles from roles.json...');
    const roles = this.getRolesFromData();
    try {
      for (const roleData of roles) {
        await this.prisma.role.upsert({
          where: { name: roleData.name },
          update: {},
          create: roleData,
        });
      }

      this.logger.log(`✅ Seeded ${roles.length} roles`);
      return await this.prisma.role.findMany({ where: { isEnabled: true } });
    } catch (error) {
      this.logger.error('Failed to seed roles:', error);
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
      lastUpdatedBy: Number(role.lastUpdatedBy) || 1,
    }));
  }
}
