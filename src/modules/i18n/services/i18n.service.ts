import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Translation } from 'generated/prisma/client';
import { DBHelper } from 'modules/helpers/services/db-helper';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { TRANSLATION_DETAIL_INCLUDE } from '../const/translation.const';
import { AppError } from 'exceptions/app.exception';
// import { TranslationDetail } from 'types/dto';
import { PaginatedDataResult } from 'types/types';
import { CreateTranslationKeyDto } from '../dto/i18n-create.dto';
import type { DataTableQuery } from 'common/data-table';
import { resolveDataTableQueryForHttp } from 'common/data-table/http';
import {
  TRANSLATION_KEY_DATA_TABLE_DEFAULT_ORDER_BY,
  TRANSLATION_KEY_DATA_TABLE_SELECT,
  translationKeyDataTablePolicy,
  translationKeyDataTablePrismaTranslator,
} from '../data-table';
import type { TranslationKeyDataTableResult } from '../data-table';

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

  /**
   * @deprecated
   * Use queryTranslationKeys() for the administrative translation table.
   *
   * Admin CRUD — list all keys with their translations across locales
   * Retained temporarily for legacy callers.
   */
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

  /**
   * @deprecated
   * Legacy Translation pagination.
   *
   * New administrative translation UI must query TranslationKey through
   * queryTranslationKeys().
   */
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

  /**
   * Query TranslationKey records for the administrative DataTable.
   *
   * This is the canonical server-side DataTable endpoint for translation
   * management.
   *
   * Pipeline:
   *
   *   DataTableQuery
   *       ↓
   *   resource policy
   *       ↓
   *   trusted resolved query
   *       ↓
   *   Prisma translator
   *       ↓
   *   DBHelper offset-page executor
   *
   * This method intentionally does not accept:
   *
   *   page
   *   pageSize
   *   where
   *   orderBy
   *   search fields
   *
   * independently.
   *
   * Those concepts are now represented by the DataTable query contract.
   */
  queryTranslationKeys(
    query: DataTableQuery,
  ): Promise<TranslationKeyDataTableResult> {
    /**
     * --------------------------------------------------------------
     * 1. Resource authorization / semantic validation
     * --------------------------------------------------------------
     *
     * This validates:
     *
     *   allowed public fields
     *   allowed operators
     *   resource-specific values
     *
     * Examples:
     *
     * categoryId = "hello"
     *   → rejected
     *
     * locale contains "km"
     *   → rejected
     *
     * secretColumn sorting
     *   → rejected
     *
     * Policy errors are converted to HTTP 400 by the HTTP adapter.
     */
    const resolvedQuery = resolveDataTableQueryForHttp(
      translationKeyDataTablePolicy,
      query,
    );

    /**
     * --------------------------------------------------------------
     * 2. Resource -> Prisma translation
     * --------------------------------------------------------------
     */
    const prismaQuery =
      translationKeyDataTablePrismaTranslator.translate(resolvedQuery);

    /**
     * --------------------------------------------------------------
     * 3. Execute through the generic DBHelper DataTable executor
     * --------------------------------------------------------------
     */
    return this.dbHelper.getDataTablePage({
      query: prismaQuery,

      /**
       * Server-owned deterministic ordering is applied only when the
       * client sends no sorting.
       */
      defaultOrderBy: TRANSLATION_KEY_DATA_TABLE_DEFAULT_ORDER_BY,

      operations: {
        /**
         * Resource owns:
         *
         *   - the actual Prisma model
         *   - selection
         *   - relation loading
         *
         * DBHelper knows none of those details.
         * The generic DBHelper does not know:
         *
         *   TranslationKey
         *   PrismaService
         *   relations
         *   select/include
         */
        findMany: ({ skip, take, where, orderBy }) =>
          this.prisma.translationKey.findMany({
            skip,
            take,
            /**
             * Do not pass an explicit undefined where.
             */
            ...(where ? { where } : {}),

            /**
             * Generic DataTable contracts use readonly arrays.
             *
             * Prisma's generated API may expect a mutable input
             * array, so create the concrete Prisma argument array
             * here at the resource boundary.
             */
            orderBy: [...orderBy],
            select: TRANSLATION_KEY_DATA_TABLE_SELECT,
          }),

        /**
         * DBHelper supplies the same translated `where` object used by
         * findMany().
         */
        count: ({ where }) =>
          where
            ? this.prisma.translationKey.count({
                where,
              })
            : this.prisma.translationKey.count(),
      },
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
