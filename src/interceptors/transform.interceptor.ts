// -----------------------------------------------------------------
// Global Response Interceptor (Handles all successful responses)
// Location: src/interceptors/transform.interceptor.ts
// -----------------------------------------------------------------
// This interceptor will wrap every successful response from your controllers
// into a standardized format.

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import statusCodes from 'http-status-codes';

export interface StandardResponse<T> {
  requestStatus: string;
  statusCode: number;
  statusText: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    // const statusCode =
    //   context.switchToHttp().getResponse().statusCode || HttpStatus.OK;

    // Get the response object with a type to ensure type safety
    const res = context.switchToHttp().getResponse<{ statusCode?: number }>();
    // Use the nullish coalescing operator for robustness
    const statusCode = res.statusCode ?? HttpStatus.OK;

    // return next.handle().pipe(
    //   // Explicitly type `data` as `T` to ensure type safety.
    //   // This tells TypeScript to trust that the value returned from the controller
    //   // handler matches the expected generic type T.
    //   map((data: T) => ({
    //     requestStatus: 'SUCCESS',
    //     statusCode: statusCode,
    //     statusText: statusCodes.getStatusText(statusCode),
    //     data: data, // `data` is the object returned from your controller method
    //   })),
    // );

    return next.handle().pipe(
      // Explicitly type `data` as `T` to ensure type safety.
      // This tells TypeScript to trust that the value returned from the controller
      // handler matches the expected generic type T.
      map((data: T) => {
        // Check if the data returned from the controller is an object
        // and has a 'message' property.
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          typeof (data as { message?: unknown }).message === 'string'
        ) {
          // Destructure the message from the rest of the data
          const { message, ...restOfData } = data;

          // If there's only a message and no other data, the data field can be null.
          const finalData =
            Object.keys(restOfData).length > 0 ? restOfData : null;
          // Always return data as type T, so merge message back into data if needed
          return {
            requestStatus: 'SUCCESS',
            statusCode,
            statusText: statusCodes.getStatusText(statusCode),
            message: message, // Move message to the top level
            data: finalData as T, // The rest of the object goes into 'data'
          };
        }

        // If not, wrap the entire data object as before.
        return {
          requestStatus: 'SUCCESS',
          statusCode,
          statusText: statusCodes.getStatusText(statusCode),
          data: data,
        };
      }),
    );
  }
}
