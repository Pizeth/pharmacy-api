import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { Prisma, UserIdentity } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';
import { PaginatedDataResult } from 'src/types/types';
import { DBHelper } from 'src/modules/helpers/services/db-helper';
import { UpdateIdentityDto } from '../dto/update-identity.dto';
import { CreateIdentityDto } from '../dto/create-identity.dto';
import { UserIdentityDetail } from 'src/types/dto';

@Injectable()
export class OidcIdentityDbService {
  private readonly context = OidcIdentityDbService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private prisma: PrismaService,
    private readonly dbHelper: DBHelper,
  ) {}

  async getOidcIdentity(
    where: Prisma.UserIdentityWhereUniqueInput,
  ): Promise<UserIdentityDetail | null> {
    try {
      // Handle composite key lookups
      if (where.providerId_providerUserId) {
        return await this.prisma.userIdentity.findUnique({
          where: {
            providerId_providerUserId: where.providerId_providerUserId,
          },
          include: {
            user: {
              include: {
                role: true,
                profile: true,
                identities: {
                  include: {
                    provider: true,
                  },
                },
                refreshTokens: true,
                auditTrail: true,
              },
            },
            provider: true,
          },
        });
      }

      // Handle regular ID lookups
      return this.getOne(where);
    } catch (error) {
      this.logger.error(
        `Error finding identity with  ${JSON.stringify(where)}:`,
        error,
      );
      throw new AppError(
        `Failed to retrieve OCID Identity that match with ${JSON.stringify(where)}!`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

  // async getOidcIdentity1(
  //   where: Prisma.UserIdentityWhereInput,
  // ): Promise<UserIdentityDetail | null> {
  //   try {
  //     const result = await this.prisma.userIdentity.findFirst({
  //       where,
  //       include: {
  //         user: {
  //           include: {
  //             role: true,
  //             profile: true,
  //             identities: {
  //               include: {
  //                 provider: true,
  //               },
  //             },
  //             refreshTokens: true,
  //             auditTrail: true,
  //           },
  //         },
  //         provider: true,
  //       },
  //     });

  //     return result;
  //   } catch (error) {
  //     this.logger.error(
  //       `Error finding identity with  ${JSON.stringify(where)}:`,
  //       error,
  //     );
  //     throw new AppError(
  //       `Failed to retrieve OCID Identity that match with ${JSON.stringify(where)}!`,
  //       HttpStatus.NOT_FOUND,
  //       this.context,
  //       error,
  //     );
  //   }
  // }

  async getOne(
    where: Prisma.UserIdentityWhereUniqueInput,
  ): Promise<UserIdentityDetail | null> {
    try {
      const model = 'userIdentity';
      const result = await this.dbHelper.findOne<
        typeof model,
        UserIdentityDetail
      >({
        model,
        where,
        include: {
          user: {
            include: {
              role: true,
              profile: true,
              identities: {
                include: {
                  provider: true,
                },
              },
              refreshTokens: true,
              auditTrail: true,
            },
          },
          provider: true,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Error finding identity with  ${JSON.stringify(where)}:`,
        error,
      );
      throw new AppError(
        `Failed to retrieve OCID Identity that match with ${JSON.stringify(where)}!`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

  async getAll(
    page: number = 1,
    pageSize: number = 10,
    cursor?: Prisma.UserWhereUniqueInput,
    where?: Prisma.UserWhereInput,
    orderBy?: Prisma.UserOrderByWithRelationInput,
    select?: Prisma.UserSelect,
  ): Promise<PaginatedDataResult<UserIdentity>> {
    const modelName = 'user';
    return this.dbHelper.getPaginatedData({
      model: modelName,
      page,
      pageSize,
      cursor,
      where,
      orderBy,
      select,
    });
  }

  async create(data: CreateIdentityDto, tx?: Prisma.TransactionClient) {
    const prismaClient = tx || this.prisma; // Use the provided tx or the default client
    return prismaClient.userIdentity.create({
      data: data,
      include: {
        user: {
          include: {
            role: true,
            profile: true,
            identities: {
              include: {
                provider: true,
              },
            },
            refreshTokens: true,
            auditTrail: true,
          },
        },
        provider: true,
      },
    });
  }

  async update(id: number, data: UpdateIdentityDto) {
    return this.prisma.userIdentity.update({
      where: { id },
      data,
      include: {
        user: {
          include: {
            role: true,
            profile: true,
            identities: {
              include: {
                provider: true,
              },
            },
            refreshTokens: true,
            auditTrail: true,
          },
        },
        provider: true,
      },
    });
  }

  async deleteProvider(id: number) {
    return this.prisma.userIdentity.delete({
      where: { id },
    });
  }
}

// async getOidcIdentity(providerId: number, identityId: string) {
//   try {
//     const identity = await this.prisma.userIdentity.findFirst({
//       where: {
//         providerId,
//         providerUserId: identityId,
//       },
//       include: {
//         user: {
//           include: {
//             role: true,
//             profile: true,
//             identities: {
//               include: {
//                 provider: true,
//               },
//             },
//             refreshTokens: true,
//             auditTrail: true,
//           },
//         },
//         provider: true,
//       },
//     });

//     if (!identity)
//       throw new AppError(
//         'Invalid provider!',
//         HttpStatus.NOT_FOUND,
//         this.context,
//         {
//           cause: `Identity id: ${identityId} associated with providerId ${providerId} does not exist!`,
//           // validProviderId: (await this.getAllProviders()).data.filter(
//           //   (p) => p.id !== id,
//           // ),
//         },
//       );

//     return identity;
//   } catch (error) {
//     this.logger.error(error);
//     return null;
//   }
// }
