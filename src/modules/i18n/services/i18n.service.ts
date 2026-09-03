import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Translation } from 'generated/prisma/client';
import { DBHelper } from 'modules/helpers/services/db-helper';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { TRANSLATION_DETAIL_INCLUDE } from '../const/translation.const';
import { AppError } from 'exceptions/app.exception';
import { PaginatedDataResult } from 'types/types';
import type { DataTableQuery } from 'common/data-table';
import { resolveDataTableQueryForHttp } from 'common/data-table/http';
import {
  TRANSLATION_KEY_DATA_TABLE_DEFAULT_ORDER_BY,
  TRANSLATION_KEY_DATA_TABLE_SELECT,
  translationKeyDataTablePolicy,
  translationKeyDataTablePrismaTranslator,
} from '../data-table';
import type { TranslationKeyDataTableResult } from '../data-table';
import type { TranslationKeyDataTableRow } from '../data-table';
import type {
  CreateTranslationInput,
  CreateTranslationKeyInput,
  TranslationLocale,
  UpdateTranslationInput,
  UpdateTranslationKeyInput,
} from '../schemas';
import type {
  DeletedTranslationKeyResult,
  DeletedTranslationResult,
  TranslationAdminResult,
  TranslationCategoryOption,
  TranslationKeyAdminResult,
} from '../types';

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

  // async createKey(data: CreateTranslationKeyDto) {
  //   return this.prisma.translationKey.create({ data });
  // }

  // async updateKey(id: number, data: Prisma.TranslationKeyUpdateInput) {
  //   return this.prisma.translationKey.update({ where: { id }, data });
  // }

  // async upsertTranslation(keyId: number, locale: string, value: string) {
  //   return this.prisma.translation.upsert({
  //     where: { keyId_locale: { keyId, locale } },
  //     update: { value },
  //     create: { keyId, locale, value },
  //   });
  // }

  // async deleteKey(id: number) {
  //   return this.prisma.translationKey.delete({ where: { id } });
  // }

  // async deleteTranslation(id: number) {
  //   return this.prisma.translation.delete({ where: { id } });
  // }

  /**
   * ------------------------------------------------------------------
   * TranslationKey detail
   * ------------------------------------------------------------------
   */
  async getTranslationKey(id: number): Promise<TranslationKeyAdminResult> {
    const translationKey = await this.prisma.translationKey.findUnique({
      where: {
        id,
      },
      select: TRANSLATION_KEY_DATA_TABLE_SELECT,
    });

    if (!translationKey) {
      throw new AppError(
        `Translation key with ID ${id} was not found.`,
        HttpStatus.NOT_FOUND,
        I18nService.name,
      );
    }

    return translationKey;
  }

  /**
   * ------------------------------------------------------------------
   * TranslationKey create
   * ------------------------------------------------------------------
   */
  async createTranslationKey(
    input: CreateTranslationKeyInput,
  ): Promise<TranslationKeyAdminResult> {
    await this.assertTranslationCategoryExists(input.categoryId);

    try {
      return await this.prisma.translationKey.create({
        data: {
          key: input.key,
          description: input.description ?? null,
          categoryId: input.categoryId,
        },

        select: TRANSLATION_KEY_DATA_TABLE_SELECT,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          `Translation key "${input.key}" already exists.`,
          HttpStatus.CONFLICT,
          I18nService.name,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------
   * TranslationKey update
   * ------------------------------------------------------------------
   */
  async updateTranslationKey(
    id: number,
    input: UpdateTranslationKeyInput,
  ): Promise<TranslationKeyAdminResult> {
    if (input.categoryId !== undefined) {
      await this.assertTranslationCategoryExists(input.categoryId);
    }

    try {
      return await this.prisma.translationKey.update({
        where: {
          id,
        },

        data: {
          ...(input.key !== undefined
            ? {
                key: input.key,
              }
            : {}),

          ...(input.description !== undefined
            ? {
                description: input.description,
              }
            : {}),

          ...(input.categoryId !== undefined
            ? {
                categoryId: input.categoryId,
              }
            : {}),
        },

        select: TRANSLATION_KEY_DATA_TABLE_SELECT,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new AppError(
            `Translation key with ID ${id} was not found.`,
            HttpStatus.NOT_FOUND,
            I18nService.name,
            error,
          );
        }

        if (error.code === 'P2002') {
          throw new AppError(
            input.key
              ? `Translation key "${input.key}" already exists.`
              : 'Translation key violates a unique constraint.',
            HttpStatus.CONFLICT,
            I18nService.name,
            error,
          );
        }
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------
   * TranslationKey delete
   * ------------------------------------------------------------------
   *
   * Translation rows are deleted automatically because your Prisma
   * relation uses:
   *
   *   onDelete: Cascade
   */
  async deleteTranslationKey(id: number): Promise<DeletedTranslationKeyResult> {
    try {
      return await this.prisma.translationKey.delete({
        where: {
          id,
        },

        select: {
          id: true,
          key: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppError(
          `Translation key with ID ${id} was not found.`,
          HttpStatus.NOT_FOUND,
          I18nService.name,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------
   * Translation categories
   * ------------------------------------------------------------------
   */
  getTranslationCategories(): Promise<TranslationCategoryOption[]> {
    return this.prisma.translationCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * ------------------------------------------------------------------
   * Translation create
   * ------------------------------------------------------------------
   */
  async createTranslation(
    keyId: number,
    input: CreateTranslationInput,
  ): Promise<TranslationAdminResult> {
    await this.assertTranslationKeyExists(keyId);

    try {
      return await this.prisma.translation.create({
        data: {
          keyId,
          locale: input.locale,
          value: input.value,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          `Translation for locale "${input.locale}" already exists on translation key ${keyId}.`,
          HttpStatus.CONFLICT,
          I18nService.name,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------
   * Translation update
   * ------------------------------------------------------------------
   */
  async updateTranslation(
    keyId: number,
    locale: TranslationLocale,
    input: UpdateTranslationInput,
  ): Promise<TranslationAdminResult> {
    try {
      return await this.prisma.translation.update({
        where: {
          keyId_locale: {
            keyId,
            locale,
          },
        },

        data: {
          value: input.value,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppError(
          `Translation "${locale}" for translation key ${keyId} was not found.`,
          HttpStatus.NOT_FOUND,
          I18nService.name,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------
   * Translation delete
   * ------------------------------------------------------------------
   */
  async deleteTranslation(
    keyId: number,
    locale: TranslationLocale,
  ): Promise<DeletedTranslationResult> {
    try {
      return await this.prisma.translation.delete({
        where: {
          keyId_locale: {
            keyId,
            locale,
          },
        },

        select: {
          id: true,
          keyId: true,
          locale: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppError(
          `Translation "${locale}" for translation key ${keyId} was not found.`,
          HttpStatus.NOT_FOUND,
          I18nService.name,
          error,
        );
      }

      throw error;
    }
  }

  /**
   * Verify a TranslationCategory before using its ID in a write.
   *
   * This gives the API a clean 404 rather than leaking a database
   * foreign-key failure.
   */
  private async assertTranslationCategoryExists(
    categoryId: number,
  ): Promise<void> {
    const category = await this.prisma.translationCategory.findUnique({
      where: {
        id: categoryId,
      },

      select: {
        id: true,
      },
    });

    if (!category) {
      throw new AppError(
        `Translation category with ID ${categoryId} was not found.`,
        HttpStatus.NOT_FOUND,
        I18nService.name,
      );
    }
  }

  /**
   * Lightweight existence check used before creating a Translation.
   */
  private async assertTranslationKeyExists(keyId: number): Promise<void> {
    const translationKey = await this.prisma.translationKey.findUnique({
      where: {
        id: keyId,
      },

      select: {
        id: true,
      },
    });

    if (!translationKey) {
      throw new AppError(
        `Translation key with ID ${keyId} was not found.`,
        HttpStatus.NOT_FOUND,
        I18nService.name,
      );
    }
  }
}
