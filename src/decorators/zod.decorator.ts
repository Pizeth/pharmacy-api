import { Body, applyDecorators } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
// import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { ZodObject } from 'zod';
// import { ZodValidationPipe } from '../pipes/zod-validation.pipe'; // Adjust path as needed

/**
 * A custom parameter decorator that combines @Body() with ZodValidationPipe.
 * This simplifies applying Zod validation to incoming request bodies.
 * @param schema The Zod schema to validate against.
 */
export const ZodBody = (schema: ZodObject<any>) => {
  // applyDecorators is a helper function that combines multiple decorators.
  // Here, it's just applying the @Body decorator with our custom pipe.
  return Body(new ZodValidationPipe(schema));
};
