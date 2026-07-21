// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/modules/i18n/dto/i18n.dto.ts
// -----------------------------------------------------------------
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const createTranslationKeySchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .meta({
      description: 'Key for the Translation.',
      example: 'VALIDATION_KEY',
    }),
  description: z
    .string()
    .trim()
    .max(255, 'Description cannot exceed 255 characters')
    .optional()
    .meta({
      description: 'The description of the translation key.',
      example: 'For username validation',
    }),
  categoryId: z.coerce
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'This field is required'
          : 'CategoryId must be a number',
    })
    .int()
    .positive('CategoryId must be a positive integer.')
    .meta({
      description: 'The Category ID of the key assigned to the translation.',
      example: 1,
    }),
});

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateTranslationKeyDto extends createZodDto(
  createTranslationKeySchema,
) {}
