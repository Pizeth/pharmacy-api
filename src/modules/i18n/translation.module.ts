import { Module } from '@nestjs/common';
import { I18nController } from './controllers/i18n.controller';
import { I18nService } from './services/i18n.service';
import { I18nAdminController } from './controllers/i18n-admin.controller';

@Module({
  controllers: [
    /**
     * Public/runtime i18next endpoint + temporarily retained legacy
     * CRUD endpoints.
     */
    I18nController,

    /**
     * New versioned administrative API.
     */
    I18nAdminController,
  ],
  providers: [I18nService],
})
export class TranslationModule {}
