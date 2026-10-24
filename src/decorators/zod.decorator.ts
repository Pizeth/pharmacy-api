import { Body } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Native NestJS 12 Standard Schema body decorator.
 *
 * Zod 4 implements Standard Schema, so Nest can consume the schema directly.
 * Validation is performed by the global StandardSchemaValidationPipe.
 */
export const ZodBody = <TSchema extends ZodType>(schema: TSchema) =>
  Body({ schema });
