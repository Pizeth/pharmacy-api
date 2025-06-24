import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { type } from 'src/types/commons.enum';
import { R2ErrorResponse } from 'src/types/types';

@Catch()
export class R2ExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    // const errorResponse: R2ErrorResponse = {
    //   status: exception.status || 500,
    //   message: exception.message || 'Internal Server Error',
    //   fileName: 'N/A',
    //   error: exception.error || exception.toString(),
    // };

    const errorResponse: R2ErrorResponse = {
      type: type.Error,
      status: this.getStatus(exception),
      message: this.getMessage(exception),
      fileName: 'N/A',
      error: this.getError(exception),
    };

    response.status(errorResponse.status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    return exception && typeof exception === 'object' && 'status' in exception
      ? Number(exception.status)
      : 500;
  }

  private getMessage(exception: unknown): string {
    return exception && typeof exception === 'object' && 'message' in exception
      ? String(exception.message)
      : 'Internal Server Error';
  }

  private getError(exception: unknown): string {
    if (exception && typeof exception === 'object' && 'error' in exception) {
      return String(exception.error);
    }
    return String(exception);
  }
}

// catch(exception: unknown, host: ArgumentsHost) {
//   const response = host.switchToHttp().getResponse<Response>();

//   const errorResponse: R2ErrorResponse = {
//     status: this.getStatus(exception),
//     message: this.getMessage(exception),
//     fileName: 'N/A',
//     error: this.getError(exception),
//   };

//   response.status(errorResponse.status).json(errorResponse);
// }
