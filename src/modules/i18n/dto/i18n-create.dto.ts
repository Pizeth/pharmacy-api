/**
 * Compatibility export for older imports.
 *
 * The canonical TranslationKey request schema lives under ../schemas and is
 * consumed directly by NestJS 12 route parameter metadata.
 */
export { createTranslationKeySchema } from '../schemas';
export type { CreateTranslationKeyInput as CreateTranslationKeyDto } from '../schemas';
