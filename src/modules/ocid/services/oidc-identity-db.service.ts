import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { Prisma, UserIdentity } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';
import { PaginatedDataResult } from 'src/types/types';
import { DBHelper } from 'src/modules/helpers/services/db-helper';
import { UpdateIdentityDto } from '../dto/update-identity.dto';
import { CreateIdentityDto } from '../dto/create-identity.dto';

@Injectable()
export class OidcIdentityDbService {
  private readonly context = OidcIdentityDbService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private prisma: PrismaService,
    private readonly dbHelper: DBHelper,
  ) {}

  async getOidcIdentity(providerId: number, identityId: string) {
    try {
      const identity = await this.prisma.userIdentity.findFirst({
        where: {
          providerId,
          providerUserId: identityId,
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

      if (!identity)
        throw new AppError(
          'Invalid provider!',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `Identity id: ${identityId} associated with providerId ${providerId} does not exist!`,
            // validProviderId: (await this.getAllProviders()).data.filter(
            //   (p) => p.id !== id,
            // ),
          },
        );

      return identity;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  //   async getProviderByName(name: string): Promise<IdentityProvider> {
  //     try {
  //       const provider = await this.prisma.identityProvider.findUnique({
  //         where: { name },
  //       });

  //       if (!provider)
  //         throw new AppError(
  //           'Invalid provider!',
  //           HttpStatus.NOT_FOUND,
  //           this.context,
  //           {
  //             cause: `Provider with name ${name} does not exist!`,
  //             // validProvider: this.getAllEnabledProviders(),
  //             validProvider: this.getAllProviders(),
  //           },
  //         );

  //       return provider;
  //     } catch (error) {
  //       this.logger.error(error);
  //       throw error;
  //     }
  //   }

  async getAllRegisteredIdentities(
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
