/**
 * Compatibility export for older imports.
 *
 * The canonical update schema is schema-first and no longer relies on Swagger
 * mapped DTO classes.
 */
export { updateTranslationKeySchema } from '../schemas';
export type { UpdateTranslationKeyInput as UpdateTranslationKeyDto } from '../schemas';
