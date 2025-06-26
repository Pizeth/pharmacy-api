/* eslint-disable @typescript-eslint/no-unused-vars */

// Placeholder for Axios-like Response and Error interfaces
interface AxiosResponse<T = any, D = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config?: any;
  request?: any;
}

export interface AxiosError<T = any, D = any> extends Error {
  config?: any;
  code?: string;
  request?: any;
  response?: AxiosResponse<T, D>;
  isAxiosError: boolean; // Key property to identify AxiosError
  toJSON: () => object;
}
