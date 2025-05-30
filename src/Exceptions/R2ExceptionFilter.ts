import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';

@Catch()
export class R2ExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    const errorResponse: R2ErrorResponse = {
      status: exception.status || 500,
      message: exception.message || 'Internal Server Error',
      fileName: 'N/A',
      error: exception.error || exception.toString(),
    };

    response.status(errorResponse.status).json(errorResponse);
  }
}
