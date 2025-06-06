// utils/errorHandler.js

export class AppError extends Error {
  private statusCode: number;
  private isOperational: boolean;
  private error: unknown;
  constructor(message: string, statusCode: number, data: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.error = data;
    Error.captureStackTrace(this, this.constructor);
  }
  getStatusCode(): number {
    return this.statusCode;
  }
  getError(): unknown {
    return this.error;
  }
  getIsOperational(): boolean {
    return this.isOperational;
  }
}
