// import * as express from 'express';

import { TokenPayload } from './token';

// declare module 'express' {
//   export interface Request {
//     correlationId?: string;
//   }
// }

// We are telling TypeScript that inside the `Express` namespace, the `Request`
// interface should also have an optional `user` property of type `TokenPayload`.
declare global {
  namespace Express {
    export interface Request {
      user?: TokenPayload;
      correlationId?: string;
    }
  }
}

// IMPORTANT: For this to work, you must add an empty `export {}` at the end
// of the file. This tells TypeScript to treat this file as a module and
// apply the declaration merging correctly.
export {};
