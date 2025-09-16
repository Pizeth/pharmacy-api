import type {
  TokenEndpointResponse,
  TokenEndpointResponseHelpers,
  DPoPHandle,
} from 'openid-client';
import type { VerifyCallback } from './interfaces/oidc.interface';
import { Request } from 'express';

// export type VerifyFunction = (
//   tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
//   done: VerifyCallback,
// ) => void;

// export type AuthenticateCallback = (
//   err: Error | null,
//   user?: Express.User | false | null,
//   info?: object | string | Array<string | undefined>,
//   status?: number | Array<number | undefined>,
// ) => void;

// interface SafeAuthenticateCallback {
//   (
//     err: Error | null,
//     user?: Express.User | false | null,
//     info?: object | string | Array<string | undefined>,
//     status?: number | Array<number | undefined>,
//   ): void;
// }

/**
 * Retrieve an openid-client DPoPHandle for a given request.
 */
export type getDPoPHandle = (
  req: Request,
) => Promise<DPoPHandle | undefined> | DPoPHandle | undefined;

// Verify function types
export type VerifyFunction = (
  /**
   * Parsed Token Endpoint Response returned by the authorization server with
   * attached helpers.
   */
  tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
  done: VerifyCallback,
) => void;

export type VerifyFunctionWithRequest = (
  /**
   * Parsed Token Endpoint Response returned by the authorization server with
   * attached helpers.
   */
  req: Request,
  tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
  done: VerifyCallback,
) => void;

export type TrustProxyFn = (addr: string | undefined, index: number) => boolean;
