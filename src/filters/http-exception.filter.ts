// -----------------------------------------------------------------
// Global Exception Filter (Handles all errors)
// Location: src/filters/http-exception.filter.ts
// -----------------------------------------------------------------
// This filter will catch all thrown exceptions (HttpException, AppError, and any other errors)
// and format them into your desired standardized error response.

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  //   HttpException,
  //   HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
// import { UAParser } from 'ua-parser-js';
import statusCodes from 'http-status-codes';
import { ClsService } from 'nestjs-cls';
// import { ExceptionData } from 'src/types/exception';
import { ExceptionService } from 'src/commons/services/exception.service';
import { UAParser } from 'ua-parser-js';

@Injectable()
@Catch() // Using @Catch() without arguments catches all types of exceptions.
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly excService: ExceptionService,
    private readonly cls: ClsService,
  ) {
    // If you have a custom exception service, you can inject it here.
    // this.exceptionService = exceptionService;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const parser = new UAParser(this.cls.get('userAgent'));
    // Use the helper to get standardized error details
    const { statusCode, message, errors } =
      this.excService.parseUnknownException(exception);

    // This is your standardized error response structure.
    const errorResponse: Record<string, unknown> = {
      requestStatus: this.excService.displayStatus(statusCode), // e.g., 'CLIENT_ERROR'
      statusCode,
      statusText: statusCodes.getStatusText(statusCode),
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ip: request.ip,
      correlationId: this.cls.get('correlationId'), // <-- Enrich response with correlationId
      message,
      userAgent: {
        browser: parser.getBrowser(),
        os: parser.getOS(),
        device: parser.getDevice(),
      },
      // Include validation errors from class-validator or nestjs-zod if they exist
      // Conditionally add the 'errors' field only if it exists and is an object.
      ...(errors && typeof errors === 'object' ? { errors } : {}),
    };

    // Log the error using your custom logging logic
    this.excService.logError(this.cls, exception);

    response.status(statusCode).json(errorResponse);
  }

  //   // Helper to get a high-level status string
  //   private displayStatus(code: number): string {
  //     const statusGroups: { [key: number]: string } = {
  //       100: 'INFORMATIONAL',
  //       200: 'SUCCESS', // Should not happen for errors, but included for completeness
  //       300: 'REDIRECTION',
  //       400: 'CLIENT_ERROR',
  //       500: 'SERVER_ERROR',
  //     };
  //     const firstDigit = Math.floor(code / 100) * 100;
  //     return statusGroups[firstDigit] || 'UNKNOWN_STATUS';
  //   }

  //   // Centralized error logging method
  //   private logError(request: Request, exception: unknown) {
  //     const parser = new UAParser(request.headers['user-agent']);
  //     const { statusCode, message, errors } =
  //       this.parseUnknownException(exception);

  //     const errorLog = {
  //       statusCode,
  //       timestamp: new Date().toISOString(),
  //       path: request.url,
  //       method: request.method,
  //       ip: request.ip,
  //       message,
  //       userAgent: {
  //         browser: parser.getBrowser(),
  //         os: parser.getOS(),
  //         device: parser.getDevice(),
  //       },
  //       // Include stack trace in development for easier debugging
  //       ...(process.env.NODE_ENV === 'development' && {
  //         stack: (errors as Error)?.stack,
  //       }),
  //     };

  //     this.logger.error('HTTP Exception:', JSON.stringify(errorLog, null, 2));
  //   }

  //   private parseHttpException(exception: HttpException): ExceptionData {
  //     const statusCode = exception.getStatus();
  //     const response = exception.getResponse();

  //     // 1) If the response is a plain string, that’s our message
  //     if (typeof response === 'string') {
  //       return {
  //         statusCode,
  //         message: response,
  //         errors: undefined, // No additional errors in this case
  //       };
  //     }

  //     // 2) Otherwise we expect an object
  //     if (this.isErrorObject(response)) {
  //       return {
  //         statusCode,
  //         message: this.getMessage(response, exception.message),
  //         errors: 'errors' in response ? response.errors : undefined,
  //       };
  //     }

  //     // 3) Fallback for other unexpected HttpException payloads
  //     return { statusCode, message: exception.message, errors: response };
  //   }

  //   // Helper function to safely parse exception response
  //   private parseUnknownException(exception: unknown): ExceptionData {
  //     if (exception instanceof HttpException) {
  //       return this.parseHttpException(exception);
  //     }
  //     const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  //     if (exception instanceof Error) {
  //       return {
  //         statusCode,
  //         message: exception.message,
  //         // For generic errors, the stack is the most useful detail
  //         errors: exception.stack ? exception.stack : undefined,
  //       };
  //     }

  //     // Fallback for non-Error, non-HttpException payloads
  //     return {
  //       statusCode,
  //       message: 'An unknown internal error occurred.',
  //       errors: exception,
  //     };
  //   }

  //   // Helper utilities
  //   private isErrorObject(obj: unknown): obj is Record<string, unknown> {
  //     return typeof obj === 'object' && obj !== null;
  //   }

  //   private getMessage(
  //     response: Record<string, unknown>,
  //     fallback: string,
  //   ): string {
  //     if (!('message' in response)) return fallback;

  //     const msg = response.message;
  //     if (typeof msg === 'string') return msg;
  //     if (Array.isArray(msg)) return msg.join('; '); // Handle array messages

  //     return fallback;
  //   }
}

// const statusCode =
//   exception instanceof HttpException
//     ? exception.getStatus()
//     : HttpStatus.INTERNAL_SERVER_ERROR;

// const message =
//   exception instanceof HttpException
//     ? exception.message
//     : 'Internal server error';

// const exceptionResponse =
//   exception instanceof HttpException ? exception.getResponse() : null;

//   // Helper function to safely parse exception response
//   private parseExceptionResponse = (
//     exceptionResponse: unknown,
//     fallbackMessage: string,
//   ): ExceptionData => {
//     // Handle string responses
//     if (typeof exceptionResponse === 'string') {
//       return {
//         statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
//         message: exceptionResponse,
//       };
//     }

//     if (this.isErrorObject(exceptionResponse)) {
//       const message =
//         typeof exceptionResponse.message === 'string'
//           ? exceptionResponse.message
//           : fallbackMessage;

//       return {
//         message,
//         statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
//         errors:
//           'errors' in exceptionResponse ? exceptionResponse.errors : undefined,
//       };
//     }

//     // Handle object responses
//     if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
//       const message =
//         'message' in exceptionResponse &&
//         typeof exceptionResponse.message === 'string'
//           ? exceptionResponse.message
//           : fallbackMessage;

//       const errors =
//         'errors' in exceptionResponse ? exceptionResponse.errors : undefined;

//       return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message, errors };
//     }

//     return { message: fallbackMessage };
//   };

//   // Main exception handling logic with cleaner structure
//   private getExceptionData = (exception: unknown): ExceptionData => {
//     const statusCode =
//       exception instanceof HttpException
//         ? exception.getStatus()
//         : HttpStatus.INTERNAL_SERVER_ERROR;

//     if (exception instanceof HttpException) {
//       const { message, errors } = this.parseHttpException(exception);
//       return { statusCode, message, errors };
//     }

//     if (exception instanceof Error) {
//       return { statusCode, message: exception.message, errors: exception };
//     }

//     return { statusCode, message: 'Internal server error', errors: exception };
//   };
