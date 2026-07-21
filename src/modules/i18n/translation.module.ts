import { Module } from '@nestjs/common';
import { I18nController } from './controllers/i18n.controller';
import { I18nService } from './services/i18n.service';

@Module({
  controllers: [I18nController],
  providers: [I18nService],
})
export class TranslationModule {}
