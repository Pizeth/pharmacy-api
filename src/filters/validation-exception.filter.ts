// src/common/filters/ValidationExceptionFilter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'src/exceptions/zod-validatoin.exception';

@Catch(ValidationError)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Log: keep both human-readable + structured
    console.error('❌ Validation failed:\n' + exception.details);
    console.error('Structured tree:', JSON.stringify(exception.tree, null, 2));

    // Respond to client
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Validation Failed',
      message: exception.details.split('\n'), // array of "path: message"
      issues: exception.issues, // raw ZodIssue[]
      tree: exception.tree, // structured error tree (from treeifyError)
      timestamp: new Date().toISOString(),
    });
  }
}
