// // utils/errorHandler.js

// export class AppError extends Error {
//   // You can add any custom properties you need
//   public readonly context?: string;
//   public readonly errorData?: object;
//   private statusCode: number;
//   private isOperational: boolean;
//   private error: unknown;
//   constructor(message: string, statusCode: number, data: unknown) {
//     super(message);
//     this.statusCode = statusCode;
//     this.isOperational = true;
//     this.error = data;
//     Error.captureStackTrace(this, this.constructor);
//   }
//   getStatusCode(): number {
//     return this.statusCode;
//   }
//   getError(): unknown {
//     return this.error;
//   }
//   getIsOperational(): boolean {
//     return this.isOperational;
//   }
// }

// import { HttpException, HttpStatus } from '@nestjs/common';

// export class AppError extends HttpException {
//   // You can add any custom properties you need
//   public readonly context?: string;
//   public readonly errorData?: object;
//   public statusCode: number;
//   private isOperational: boolean;
//   private error: unknown;
//   constructor(
//     message: string,
//     statusCode: HttpStatus,
//     context?: string,
//     errorData?: object,
//   ) {
//     // The `super()` call passes the main message and status code to the base HttpException.
//     // The response object can contain both the message and additional details.
//     super({ message, statusCode, context, errorData }, statusCode);
//     this.context = context;
//     this.errorData = errorData;
//   }
// }
