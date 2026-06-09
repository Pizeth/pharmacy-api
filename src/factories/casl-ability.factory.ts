import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { PrismaService } from 'modules/prisma/services/prisma.service';
// import { Prisma } from 'generated/prisma/browser';
// import { PrismaService } from '../prisma/prisma.service';

export type AppAbility = MongoAbility;

// type UserWithRole = Prisma.UserGetPayload<{
//   include: {
//     userRole: {
//       include: {
//         permissions: {
//           include: { permission: true };
//         };
//       };
//     };
//   };
// }>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private prisma: PrismaService) {}

  async createForUser(userId: number): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // Load user's role and permissions from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRole: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    // if (!user) return build();
    if (!user || !user.userRole) return build();

    // for (const rp of user.userRole.permissions) {
    //   can(rp.permission.action, rp.permission.subject);
    // }

    for (const rp of user.userRole?.permissions ?? []) {
      can(rp.permission.action, rp.permission.subject);
    }

    return build();
  }
}
