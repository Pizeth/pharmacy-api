export interface ExceptionData {
  statusCode: number;
  message: string;
  errors?: unknown;
  // errors?: Record<string, any> | string[] | Error | object; // depending on your error structure
  // errors?: any;
}
