// // src/modules/i18n/controllers/i18n-admin.controller.ts

// import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
// import { ApiOperation, ApiTags } from '@nestjs/swagger';
// // import { UserHasPermission } from '@thallesp/nestjs-better-auth';
// import { dataTableQuerySchema } from 'common/data-table';
// import type { DataTableQuery } from 'common/data-table';
// import type { TranslationKeyDataTableResult } from '../data-table';
// import { I18nService } from '../services/i18n.service';
// import { AppAction, AppSubject } from 'modules/authorization/casl/app-ability';
// import { RequirePermission } from 'decorators/permissions.decorator';

// /**
//  * Administrative translation endpoints.
//  *
//  * This controller is intentionally separate from I18nController.
//  *
//  * I18nController:
//  *
//  *   GET /i18n/:locale
//  *
//  * is the public runtime endpoint consumed by i18next-http-backend.
//  *
//  *
//  * I18nAdminController:
//  *
//  *   /v1/i18n/...
//  *
//  * owns authenticated translation-management operations.
//  */
// @ApiTags('I18n Admin')
// @Controller({
//   path: 'i18n',
//   version: '1',
// })
// export class I18nAdminController {
//   constructor(private readonly i18nService: I18nService) {}

//   /**
//    * Query TranslationKey records for the administrative DataTable.
//    *
//    * POST is intentional because DataTable queries contain structured:
//    *
//    *   sorting[]
//    *   filters[]
//    *   search
//    *
//    * Using JSON avoids coupling the server contract to arbitrary
//    * query-string serialization.
//    *
//    * Example:
//    *
//    * {
//    *   "page": 1,
//    *   "pageSize": 25,
//    *   "sorting": [
//    *     {
//    *       "field": "category",
//    *       "direction": "asc"
//    *     }
//    *   ],
//    *   "filters": [
//    *     {
//    *       "field": "locale",
//    *       "operator": "equals",
//    *       "value": "km"
//    *     }
//    *   ],
//    *   "search": {
//    *     "term": "login"
//    *   }
//    * }
//    */
//   @Post('keys/query')
//   @HttpCode(HttpStatus.OK)
//   // @UserHasPermission({
//   //   permission: {
//   //     translation: ['read'],
//   //   },
//   // })
//   @RequirePermission(AppAction.Read, AppSubject.TranslationKey)
//   @ApiOperation({
//     summary: 'Query translation keys for the administrative DataTable',
//     description:
//       'Queries TranslationKey records using validated server-side pagination, sorting, filtering, and global search.',
//   })
//   queryTranslationKeys(
//     /**
//      * Native NestJS 12 Standard Schema validation.
//      *
//      * The global StandardSchemaValidationPipe validates the request
//      * body against Zod schema before this controller method executes.
//      */
//     @Body({
//       schema: dataTableQuerySchema,
//     })
//     query: DataTableQuery,
//   ): Promise<TranslationKeyDataTableResult> {
//     return this.i18nService.queryTranslationKeys(query);
//   }
// }

// src/modules/i18n/controllers/i18n-admin.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { dataTableQuerySchema } from 'common/data-table';
import type { DataTableQuery } from 'common/data-table';
import {
  AppAction,
  AppSubject,
  RequirePermission,
} from 'modules/authorization';
import type { TranslationKeyDataTableResult } from '../data-table';
import {
  createTranslationKeySchema,
  createTranslationSchema,
  positiveIntegerParamSchema,
  translationLocaleSchema,
  updateTranslationKeySchema,
  updateTranslationSchema,
} from '../schemas';
import type {
  CreateTranslationInput,
  CreateTranslationKeyInput,
  PositiveIntegerParam,
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
import { I18nService } from '../services/i18n.service';

/**
 * Administrative translation endpoints.
 *
 * This controller is intentionally separate from I18nController.
 *
 * I18nController:
 *
 *   GET /i18n/:locale
 *
 * is the public runtime endpoint consumed by i18next-http-backend.
 *
 *
 * I18nAdminController:
 *
 *   /v1/i18n/...
 *
 * owns authenticated translation-management operations.
 */
@ApiTags('I18n Admin')
@Controller({
  path: 'i18n',
  version: '1',
})
export class I18nAdminController {
  constructor(private readonly i18nService: I18nService) {}

  /**
   * ================================================================
   * TranslationKey DataTable
   * ================================================================
   *
   * Query TranslationKey records for the administrative DataTable.
   *
   * POST is intentional because DataTable queries contain structured:
   *
   *   sorting[]
   *   filters[]
   *   search
   *
   * Using JSON avoids coupling the server contract to arbitrary
   * query-string serialization.
   *
   * Example:
   *
   * {
   *   "page": 1,
   *   "pageSize": 25,
   *   "sorting": [
   *     {
   *       "field": "category",
   *       "direction": "asc"
   *     }
   *   ],
   *   "filters": [
   *     {
   *       "field": "locale",
   *       "operator": "equals",
   *       "value": "km"
   *     }
   *   ],
   *   "search": {
   *     "term": "login"
   *   }
   * }
   */

  @Post('keys/query')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AppAction.Read, AppSubject.TranslationKey)
  @ApiOperation({
    summary: 'Query translation keys for the administrative DataTable',
    description:
      'Queries TranslationKey records using validated server-side pagination, sorting, filtering, and global search.',
  })
  queryTranslationKeys(
    /**
     * Native NestJS 12 Standard Schema validation.
     *
     * The global StandardSchemaValidationPipe validates the request
     * body against Zod schema before this controller method executes.
     */
    @Body({
      schema: dataTableQuerySchema,
    })
    query: DataTableQuery,
  ): Promise<TranslationKeyDataTableResult> {
    return this.i18nService.queryTranslationKeys(query);
  }

  /**
   * ================================================================
   * TranslationKey detail
   * ================================================================
   */

  @Get('keys/:id')
  @RequirePermission(AppAction.Read, AppSubject.TranslationKey)
  @ApiOperation({
    summary: 'Get one translation key',
  })
  getTranslationKey(
    @Param('id', {
      schema: positiveIntegerParamSchema,
    })
    id: PositiveIntegerParam,
  ): Promise<TranslationKeyAdminResult> {
    return this.i18nService.getTranslationKey(id);
  }

  /**
   * ================================================================
   * TranslationKey create
   * ================================================================
   */

  @Post('keys')
  @RequirePermission(AppAction.Create, AppSubject.TranslationKey)
  @ApiOperation({
    summary: 'Create a translation key',
  })
  createTranslationKey(
    @Body({
      schema: createTranslationKeySchema,
    })
    input: CreateTranslationKeyInput,
  ): Promise<TranslationKeyAdminResult> {
    return this.i18nService.createTranslationKey(input);
  }

  /**
   * ================================================================
   * TranslationKey update
   * ================================================================
   */

  @Patch('keys/:id')
  @RequirePermission(AppAction.Update, AppSubject.TranslationKey)
  @ApiOperation({
    summary: 'Update a translation key',
  })
  updateTranslationKey(
    @Param('id', {
      schema: positiveIntegerParamSchema,
    })
    id: PositiveIntegerParam,

    @Body({
      schema: updateTranslationKeySchema,
    })
    input: UpdateTranslationKeyInput,
  ): Promise<TranslationKeyAdminResult> {
    return this.i18nService.updateTranslationKey(id, input);
  }

  /**
   * ================================================================
   * TranslationKey delete
   * ================================================================
   */

  @Delete('keys/:id')
  @RequirePermission(AppAction.Delete, AppSubject.TranslationKey)
  @ApiOperation({
    summary: 'Delete a translation key',
  })
  deleteTranslationKey(
    @Param('id', {
      schema: positiveIntegerParamSchema,
    })
    id: PositiveIntegerParam,
  ): Promise<DeletedTranslationKeyResult> {
    return this.i18nService.deleteTranslationKey(id);
  }

  /**
   * ================================================================
   * Translation categories
   * ================================================================
   */

  @Get('categories')
  @RequirePermission(AppAction.Read, AppSubject.TranslationCategory)
  @ApiOperation({
    summary: 'List translation categories',
    description:
      'Returns lightweight category options for forms and DataTable filters.',
  })
  getTranslationCategories(): Promise<TranslationCategoryOption[]> {
    return this.i18nService.getTranslationCategories();
  }

  /**
   * ================================================================
   * Translation create
   * ================================================================
   *
   * Unlike the legacy upsert endpoint, creation and updating now have
   * separate authorization semantics.
   */

  @Post('keys/:keyId/translations')
  @RequirePermission(AppAction.Create, AppSubject.Translation)
  @ApiOperation({
    summary: 'Create a locale translation for a key',
  })
  createTranslation(
    @Param('keyId', {
      schema: positiveIntegerParamSchema,
    })
    keyId: PositiveIntegerParam,

    @Body({
      schema: createTranslationSchema,
    })
    input: CreateTranslationInput,
  ): Promise<TranslationAdminResult> {
    return this.i18nService.createTranslation(keyId, input);
  }

  /**
   * ================================================================
   * Translation update
   * ================================================================
   */

  @Patch('keys/:keyId/translations/:locale')
  @RequirePermission(AppAction.Update, AppSubject.Translation)
  @ApiOperation({
    summary: 'Update a locale translation',
  })
  updateTranslation(
    @Param('keyId', {
      schema: positiveIntegerParamSchema,
    })
    keyId: PositiveIntegerParam,

    @Param('locale', {
      schema: translationLocaleSchema,
    })
    locale: TranslationLocale,

    @Body({
      schema: updateTranslationSchema,
    })
    input: UpdateTranslationInput,
  ): Promise<TranslationAdminResult> {
    return this.i18nService.updateTranslation(keyId, locale, input);
  }

  /**
   * ================================================================
   * Translation delete
   * ================================================================
   */

  @Delete('keys/:keyId/translations/:locale')
  @RequirePermission(AppAction.Delete, AppSubject.Translation)
  @ApiOperation({
    summary: 'Delete a locale translation',
  })
  deleteTranslation(
    @Param('keyId', {
      schema: positiveIntegerParamSchema,
    })
    keyId: PositiveIntegerParam,

    @Param('locale', {
      schema: translationLocaleSchema,
    })
    locale: TranslationLocale,
  ): Promise<DeletedTranslationResult> {
    return this.i18nService.deleteTranslation(keyId, locale);
  }
}
