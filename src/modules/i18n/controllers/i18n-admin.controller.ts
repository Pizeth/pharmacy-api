// src/modules/i18n/controllers/i18n-admin.controller.ts

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { dataTableQuerySchema } from 'common/data-table';
import type { DataTableQuery } from 'common/data-table';
import type { TranslationKeyDataTableResult } from '../data-table';
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
  @UserHasPermission({
    permission: {
      translation: ['read'],
    },
  })
  @ApiOperation({
    summary: 'Query translation keys for the admin DataTable',
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
}
