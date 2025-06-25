import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { ExceptionData } from 'src/types/exception';
import { UAParser } from 'ua-parser-js';

@Injectable()
// This service is a singleton that handles exceptions throughout the application.
export class ExceptionService {
  private readonly logger = new Logger(ExceptionService.name);

  constructor(
    private readonly config: ConfigService,
    // private readonly cls: ClsService,
  ) {}

  // Helper to get a high-level status string
  displayStatus(code: number): string {
    const statusGroups: { [key: number]: string } = {
      100: 'INFORMATIONAL',
      200: 'SUCCESS', // Should not happen for errors, but included for completeness
      300: 'REDIRECTION',
      400: 'CLIENT_ERROR',
      500: 'SERVER_ERROR',
    };
    const firstDigit = Math.floor(code / 100) * 100;
    return statusGroups[firstDigit] || 'UNKNOWN_STATUS';
  }

  // Centralized error logging method
  logError(cls: ClsService, exception: unknown) {
    // this.logger.error('Logging error:', exception);
    const parser = new UAParser(cls.get('userAgent'));
    const { statusCode, message, errors } =
      this.parseUnknownException(exception);

    const errorLog = {
      statusCode,
      timestamp: new Date().toISOString(),
      correlationId: cls.get<string>('correlationId'), // <-- Add correlationId to logs
      path: cls.get<string>('url'),
      method: cls.get<string>('method'),
      ip: cls.get<string>('ip'), // <-- Get IP from CLS context
      message,
      userAgent: {
        browser: parser.getBrowser(),
        os: parser.getOS(),
        device: parser.getDevice(),
      },
      // Include stack trace in development for easier debugging
      ...(this.config.get<string>('NODE_ENV')?.toLowerCase() ===
        'development' && {
        stack: errors instanceof Error ? errors.stack : errors,
      }),
    };

    this.logger.error('HTTP Exception:', JSON.stringify(errorLog, null, 2));
  }

  // Helper function to safely parse exception response
  parseUnknownException(exception: unknown): ExceptionData {
    if (exception instanceof HttpException) {
      return this.parseHttpException(exception);
    }
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof Error) {
      return {
        statusCode,
        message: exception.message,
        // For generic errors, the stack is the most useful detail
        errors: exception.stack ? exception.stack : undefined,
      };
    }

    // Fallback for non-Error, non-HttpException payloads
    return {
      statusCode,
      message: 'An unknown internal error occurred.',
      errors: exception,
    };
  }

  private parseHttpException(exception: HttpException): ExceptionData {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    // 1) If the response is a plain string, that’s our message
    if (typeof response === 'string') {
      return {
        statusCode,
        message: response,
        errors: undefined, // No additional errors in this case
      };
    }

    // 2) Otherwise we expect an object
    if (this.isErrorObject(response)) {
      return {
        statusCode,
        message: this.getMessage(response, exception.message),
        errors: 'errors' in response ? response.errors : undefined,
      };
    }

    // 3) Fallback for other unexpected HttpException payloads
    return { statusCode, message: exception.message, errors: response };
  }

  // Helper utilities
  private isErrorObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null;
  }

  private getMessage(
    response: Record<string, unknown>,
    fallback: string,
  ): string {
    if (!('message' in response)) return fallback;

    const msg = response.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join('; '); // Handle array messages

    return fallback;
  }
}
