import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import data from '../data/roles.json';
import { Role } from '@prisma/client';

// @Injectable()
export class RoleSeeder {
  private readonly logger = new Logger(RoleSeeder.name);

  constructor(private readonly prisma: PrismaService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`PrismaService injected: ${!!prisma}`);
  }

  async seed(): Promise<Role[]> {
    this.logger.log('🌱 Seeding roles from roles.json...');
    const roles = this.getRolesFromData();

    for (const roleData of roles) {
      await this.prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData,
      });
    }

    this.logger.log(`✅ Seeded ${roles.length} roles`);
    return await this.prisma.role.findMany({ where: { enabledFlag: true } });
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
