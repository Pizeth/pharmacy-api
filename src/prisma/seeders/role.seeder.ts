import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import data from '../roles.json';
import { Role } from '@prisma/client';

@Injectable()
export class RoleSeeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed() {
    // const roles = [
    //   {
    //     name: 'SUPER_ADMIN',
    //     description: 'Super Administrator with full access',
    //     createdBy: 1,
    //     lastUpdatedBy: 1,
    //   },
    //   {
    //     name: 'ADMIN',
    //     description: 'Administrator with limited access',
    //     createdBy: 1,
    //     lastUpdatedBy: 1,
    //   },
    //   { name: 'USER', description: 'Regular user' },
    //   { name: 'GUEST', description: 'Guest user with minimal access' },
    // ];
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

  private getRolesFromData(): Role[] {
    return data.roles.map((role) => ({
      name: role.name,
      description: role.description,
      createdBy: 1,
      lastUpdatedBy: 1,
    }));
  }
}
