import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import data from '../roles.json';

@Injectable()
export class RoleSeeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed() {
    const roles = this.getRolesFromData();

    for (const roleData of roles) {
      await this.prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData,
      });
    }

    console.log(`✅ Seeded ${roles.length} roles`);
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
