import type {
  TokenEndpointResponse,
  TokenEndpointResponseHelpers,
} from 'openid-client';

export type VerifyFunction = (
  tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
  done: AuthenticateCallback,
) => void;

export type AuthenticateCallback = (
  err: Error | null,
  user?: Express.User | false | null,
  info?: object | string | Array<string | undefined>,
  status?: number | Array<number | undefined>,
) => void;
