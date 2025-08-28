import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { AppError } from 'src/exceptions/app.exception';
import { PaginatedDataResult } from 'src/types/types';
import { DBHelper } from 'src/modules/helpers/services/db-helper';
import { IdentityProvider, Prisma } from '@prisma/client';

@Injectable()
export class OidcProviderDbService {
  private readonly context = OidcProviderDbService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private prisma: PrismaService,
    private readonly dbHelper: DBHelper,
  ) {}

  async getOne(
    where: Prisma.IdentityProviderWhereUniqueInput,
  ): Promise<IdentityProvider | null> {
    try {
      const model = 'identityProvider';
      const provider = await this.dbHelper.findOne<
        typeof model,
        IdentityProvider
      >({
        model,
        where: where,
      });

      // if (!provider)
      //   throw new AppError(
      //     'Invalid provider!',
      //     HttpStatus.NOT_FOUND,
      //     this.context,
      //     {
      //       cause: `Provider with ${JSON.stringify(where)} does not exist!`,
      //       // validProviderId: (await this.getAll()).data.filter(
      //       //   (p) => p.id !== id,
      //       // ),
      //     },
      //   );

      return provider;
    } catch (error) {
      this.logger.error(
        `Error finding provider that match with ${JSON.stringify(where)}:`,
        error,
      );
      throw new AppError(
        `Error finding provider that match with ${JSON.stringify(where)}`,
        HttpStatus.NOT_FOUND,
        this.context,
        { error, validProvider: this.getAll() },
      );
    }
  }

  // async getProviderByName(name: string): Promise<IdentityProvider> {
  //   try {
  //     const provider = await this.prisma.identityProvider.findUnique({
  //       where: { name },
  //     });

  //     if (!provider)
  //       throw new AppError(
  //         'Invalid provider!',
  //         HttpStatus.NOT_FOUND,
  //         this.context,
  //         {
  //           cause: `Provider with name ${name} does not exist!`,
  //           // validProvider: this.getAllEnabledProviders(),
  //           validProvider: this.getAll(),
  //         },
  //       );

  //     return provider;
  //   } catch (error) {
  //     this.logger.error(error);
  //     throw error;
  //   }
  // }

  async getAll(
    page: number = 1,
    pageSize: number = 10,
    cursor?: Prisma.IdentityProviderWhereUniqueInput,
    where?: Prisma.IdentityProviderWhereInput,
    orderBy?: Prisma.IdentityProviderOrderByWithRelationInput,
    select?: Prisma.IdentityProviderSelect,
  ): Promise<PaginatedDataResult<IdentityProvider>> {
    const modelName = 'identityProvider';
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
