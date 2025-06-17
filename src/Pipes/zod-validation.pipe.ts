// -----------------------------------------------------------------
// 1. The Custom Zod Validation Pipe
// Location: src/pipes/zod-validation.pipe.ts
// -----------------------------------------------------------------
// This pipe can be used to validate any incoming request data (body, query, params)
// against a provided Zod schema.

import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodObject, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodObject<any>) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      // Use Zod's .parse() method. It will throw a ZodError if validation fails.
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        // If validation fails, we catch the ZodError and throw a
        // NestJS BadRequestException with a formatted error message.
        throw new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          // Format Zod's error issues for a clear and readable response
          errors: error.flatten().fieldErrors,
        });
      }
      // Re-throw any other unexpected errors
      throw new BadRequestException('Invalid data');
    }
  }
}
