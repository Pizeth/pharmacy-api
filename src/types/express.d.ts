// import * as express from 'express';

import { TokenPayload } from './token';
import { OidcUser, StateData } from '../modules/ocid/interfaces/oidc.interface';
import 'express-session';
// declare module 'express' {
// declare module 'express' {
//   export interface Request {
//     correlationId?: string;
//   }
// }

// We are telling TypeScript that inside the `Express` namespace, the `Request`
// interface should also have an optional `user` property of type `TokenPayload`.
declare global {
  namespace Express {
    // This is the function Express stores under 'trust proxy fn'
    type TrustProxyFn = (addr: string, index: number) => boolean;

    interface Application {
      get(name: 'trust proxy fn'): TrustProxyFn;
    }
    export interface Request {
      user?: OidcUser;
      correlationId?: string;
      oidcProvider?: string;
    }
  }
}

// IMPORTANT: For this to work, you must add an empty `export {}` at the end
// of the file. This tells TypeScript to treat this file as a module and
// apply the declaration merging correctly.
export {};

declare module 'express-session' {
  interface SessionData {
    // Add your own session properties here
    // userId?: string;
    sessiion: StateData;
    [key: string]: unknown;
    // You can also use [key: string]: any; if you want it open-ended
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    session: import('express-session').Session &
      Partial<import('express-session').SessionData>;
  }
}

// export interface RequestInitWithDuplex extends RequestInit {
//   duplex?: 'half';
// }

// Node 18+ has global fetch types; if not, install `undici` or `node-fetch`
export type DuplexRequestInit = globalThis.RequestInit & {
  duplex?: 'half';
};
