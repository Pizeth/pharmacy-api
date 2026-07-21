import { PartialType } from '@nestjs/swagger';
import { CreateTranslationKeyDto } from './i18n-create.dto';

export class UpdateTranslationKeyDto extends PartialType(
  CreateTranslationKeyDto,
) {}
