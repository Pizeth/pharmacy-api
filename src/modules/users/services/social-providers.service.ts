import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/services/prisma.service';
import type {
  CreateSocialProviderDto,
  UpdateSocialProviderDto,
} from '../dto/social-provider.dto';

@Injectable()
export class SocialProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.socialProvider.findMany({ orderBy: { name: 'asc' } });
  }

  create(data: CreateSocialProviderDto) {
    return this.mutate(() => this.prisma.socialProvider.create({ data }));
  }

  update(id: number, data: UpdateSocialProviderDto) {
    return this.mutate(() =>
      this.prisma.socialProvider.update({ where: { id }, data }),
    );
  }

  delete(id: number) {
    return this.mutate(() =>
      this.prisma.socialProvider.delete({ where: { id } }),
    );
  }

  private async mutate<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Provider key already exists');
        if (error.code === 'P2003')
          throw new ConflictException(
            'Provider is in use; disable it or remove its profiles first',
          );
        if (error.code === 'P2025')
          throw new NotFoundException('Social provider not found');
      }
      throw error;
    }
  }
}
