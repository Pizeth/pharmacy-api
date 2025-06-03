/* eslint-disable @typescript-eslint/no-unused-vars */
import * as express from 'express';

declare module 'express' {
  export interface Request {
    correlationId?: string;
  }
}
