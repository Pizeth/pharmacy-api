import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Translation } from 'generated/prisma/client';
import { DBHelper } from 'modules/helpers/services/db-helper';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { TRANSLATION_DETAIL_INCLUDE } from '../const/translation.const';
import { AppError } from 'exceptions/app.exception';
// import { TranslationDetail } from 'types/dto';
import { PaginatedDataResult } from 'types/types';
import { CreateTranslationKeyDto } from '../dto/i18n-create.dto';

@Injectable()
export class I18nService {
  private readonly context = I18nService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly prisma: PrismaService,
    private readonly dbHelper: DBHelper,
  ) {}

  // Public — returns a flat { key: value } dictionary for a given locale
  // This is what i18next-http-backend fetches

  async getDictionary(locale: string): Promise<Record<string, string> | null> {
    try {
      const translations = await this.prisma.translation.findMany({
        where: { locale },
        include: { key: true },
      });

      //   return result;
      return translations.reduce(
        (acc, t) => {
          acc[t.key.key] = t.value;
          return acc;
        },
        {} as Record<string, string>,
      );
    } catch (error) {
      this.logger.error(
        `Error finding locale with ${JSON.stringify(locale)}:`,
        error,
      );
      throw new AppError(
        `Error finding locale that match with ${JSON.stringify(locale)}`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

  // Admin CRUD — list all keys with their translations across locales
  async findAll(page = 1, pageSize = 20, search?: string) {
    const where = search
      ? { key: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.translationKey.findMany({
        where,
        include: { translations: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { key: 'asc' },
      }),
      this.prisma.translationKey.count({ where }),
    ]);

    return { data, total };
  }

  async getAll(
    page: number = 1,
    pageSize: number = 20,
    cursor?: Prisma.TranslationWhereUniqueInput,
    where?: Prisma.TranslationWhereInput,
    include: Prisma.TranslationInclude = TRANSLATION_DETAIL_INCLUDE,
    orderBy?: Prisma.TranslationOrderByWithRelationInput,
    select?: Prisma.TranslationSelect,
    search?: string,
  ): Promise<PaginatedDataResult<Translation>> {
    const model = 'translation';
    return this.dbHelper.getPaginatedData({
      model,
      page,
      pageSize,
      cursor,
      where,
      include,
      orderBy,
      select,
      ...(search && {
        search: {
          fields: ['key'],
          term: search,
        },
      }),
    });
  }

  async createKey(data: CreateTranslationKeyDto) {
    return this.prisma.translationKey.create({ data });
  }

  async updateKey(id: number, data: Prisma.TranslationKeyUpdateInput) {
    return this.prisma.translationKey.update({ where: { id }, data });
  }

  async upsertTranslation(keyId: number, locale: string, value: string) {
    return this.prisma.translation.upsert({
      where: { keyId_locale: { keyId, locale } },
      update: { value },
      create: { keyId, locale, value },
    });
  }

  async deleteKey(id: number) {
    return this.prisma.translationKey.delete({ where: { id } });
  }

  async deleteTranslation(id: number) {
    return this.prisma.translation.delete({ where: { id } });
  }
}
