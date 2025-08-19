import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { IdentityProvider, Prisma } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';
import { PaginatedDataResult } from 'src/types/types';
import { DBHelper } from 'src/modules/helpers/services/db-helper';

@Injectable()
export class OidcProviderDbService {
  private readonly context = OidcProviderDbService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private prisma: PrismaService,
    private readonly dbHelper: DBHelper,
  ) {}

  async getProviderById(id: number) {
    try {
      const provider = await this.prisma.identityProvider.findUnique({
        where: { id },
      });

      if (!provider)
        throw new AppError(
          'Invalid provider!',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `Provider with id ${id} does not exist!`,
            validProviderId: (await this.getAllProviders()).data.filter(
              (p) => p.id !== id,
            ),
          },
        );

      return provider;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async getProviderByName(name: string): Promise<IdentityProvider> {
    try {
      const provider = await this.prisma.identityProvider.findUnique({
        where: { name },
      });

      if (!provider)
        throw new AppError(
          'Invalid provider!',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `Provider with name ${name} does not exist!`,
            // validProvider: this.getAllEnabledProviders(),
            validProvider: this.getAllProviders(),
          },
        );

      return provider;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  // async getAllProviders() {
  //   return this.prisma.identityProvider.findMany({});
  // }

  async getAllProviders(
    page: number = 1,
    pageSize: number = 10,
    cursor?: Prisma.UserWhereUniqueInput,
    where?: Prisma.UserWhereInput,
    orderBy?: Prisma.UserOrderByWithRelationInput,
    select?: Prisma.UserSelect,
  ): Promise<PaginatedDataResult<IdentityProvider>> {
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

  // async getAllEnabledProviders() {
  //   return this.prisma.identityProvider.findMany({
  //     where: { enabled: true },
  //   });
  // }

  async createProvider(data: CreateProviderDto) {
    return this.prisma.identityProvider.create({ data });
  }

  async updateProvider(id: number, data: UpdateProviderDto) {
    return this.prisma.identityProvider.update({
      where: { id },
      data,
    });
  }

  async deleteProvider(id: number) {
    return this.prisma.identityProvider.delete({
      where: { id },
    });
  }
}
