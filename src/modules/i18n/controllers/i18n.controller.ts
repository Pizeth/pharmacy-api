// src/modules/i18n/controllers/i18n.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  AllowAnonymous,
  UserHasPermission,
} from '@thallesp/nestjs-better-auth';
import { I18nService } from '../services/i18n.service';
import { CreateTranslationKeyDto } from '../dto/i18n-create.dto';
import { UpdateTranslationKeyDto } from '../dto/i18n-update.dto';
// import { TranslationsService } from './i18n.service';

@Controller({ path: 'i18n', version: VERSION_NEUTRAL })
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  // 🌐 Public — this is what i18next-http-backend fetches on the frontend
  @AllowAnonymous()
  @Get(':locale')
  async getDictionary(@Param('locale') locale: string) {
    return this.i18nService.getDictionary(locale);
  }

  // 🔒 Admin-only CRUD below
  @UserHasPermission({ permission: { translation: ['read'] } })
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.i18nService.findAll(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      search,
    );
  }

  @UserHasPermission({ permission: { translation: ['create'] } })
  @Post()
  async createKey(@Body() createTranslationKeyDto: CreateTranslationKeyDto) {
    return this.i18nService.createKey(createTranslationKeyDto);
  }

  @UserHasPermission({ permission: { translation: ['update'] } })
  @Patch(':id')
  async updateKey(
    @Param('id') id: string,
    @Body() updateTranslationKeyDto: UpdateTranslationKeyDto,
  ) {
    return this.i18nService.updateKey(Number(id), updateTranslationKeyDto);
  }

  @UserHasPermission({ permission: { translation: ['update'] } })
  @Patch(':keyId/translation/:locale')
  async upsertTranslation(
    @Param('keyId') keyId: string,
    @Param('locale') locale: string,
    @Body() body: { value: string },
  ) {
    return this.i18nService.upsertTranslation(
      Number(keyId),
      locale,
      body.value,
    );
  }

  @UserHasPermission({ permission: { translation: ['delete'] } })
  @Delete(':id')
  async deleteKey(@Param('id') id: string) {
    return this.i18nService.deleteKey(Number(id));
  }
}
