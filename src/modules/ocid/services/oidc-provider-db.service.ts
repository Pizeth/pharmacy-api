import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { IdentityProvider } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class OidcProviderDbService {
  private readonly context = OidcProviderDbService.name;
  private readonly logger = new Logger(this.context);
  constructor(private prisma: PrismaService) {}

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
            validProviderId: (await this.getAllEnabledProviders()).filter(
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
            validProvider: this.getAllEnabledProviders(),
          },
        );

      return provider;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async getAllEnabledProviders() {
    return this.prisma.identityProvider.findMany({
      where: { enabled: true },
    });
  }
}
