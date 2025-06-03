import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService extends Logger {
  log(message: string, context?: string, correlationId?: string) {
    super.log(`[${correlationId}] ${message}`, context);
  }

  error(
    message: string,
    trace: string,
    context?: string,
    correlationId?: string,
  ) {
    super.error(`[${correlationId}] ${message}`, trace, context);
  }
}
