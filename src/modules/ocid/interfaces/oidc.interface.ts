import { JsonValue, UserInfoResponse } from 'openid-client';
import passport from 'passport';
import * as oidc from 'openid-client';
import { getDPoPHandle } from '../types/oidc';
// import { Profile, StrategyOptions } from 'passport-openidconnect';

// Type-safe callback interface for NestJS (replacing passport.AuthenticateCallback)
export interface VerifyCallback {
  (
    error: Error | false | null,
    user?: Express.User | false,
    info?: object | string | Array<string | undefined>,
    status?: number | Array<number | undefined>,
  ): void;
}

// Base strategy options interface
export interface StrategyOptionsBase {
  /**
   * Openid-client Configuration instance.
   */
  config: oidc.Configuration;
  /**
   * Name of the strategy, default is the host component of the authorization
   * server's issuer identifier.
   */
  name?: string;
  /**
   * Property in the session to use for storing the authorization request state,
   * default is the host component of the authorization server's issuer
   * identifier.
   */
  sessionKey?: string;
  /**
   * Function used to retrieve an openid-client DPoPHandle for a given request,
   * when provided the strategy will use DPoP where applicable.
   */
  DPoP?: getDPoPHandle;
  /**
   * An absolute URL to which the authorization server will redirect the user
   * after obtaining authorization. The {@link !URL} instance's `href` will be
   * used as the `redirect_uri` authorization request and token endpoint request
   * parameters. When string is provided it will be internally casted to a
   * {@link URL} instance.
   */
  callbackURL?: URL | string;
  /**
   * OAuth 2.0 Authorization Request Scope. This will be used as the `scope`
   * authorization request parameter unless specified through other means.
   */
  scope?: string;
  /**
   * OAuth 2.0 Rich Authorization Request(s). This will be used as the
   * `authorization_details` authorization request parameter unless specified
   * through other means.
   */
  authorizationDetails?:
    | oidc.AuthorizationDetails
    | oidc.AuthorizationDetails[];
  /**
   * OAuth 2.0 Resource Indicator(s). This will be used as the `resource`
   * authorization request parameter unless specified through other means.
   */
  resource?: string | string[];
  /**
   * Whether the strategy will use PAR. Default is `false`.
   */
  usePAR?: boolean;
  /**
   * Whether the strategy will use JAR. Its value can be a private key to sign
   * with or an array with the private key and a modify assertion function that
   * will be used to modify the request object before it is signed. Default is
   * `false`.
   */
  useJAR?:
    | false
    | CryptoKey
    | oidc.PrivateKey
    | [CryptoKey | oidc.PrivateKey, oidc.ModifyAssertionFunction];
  /**
   * Whether the verify function should get the `req` as first argument instead.
   * Default is `false`.
   */
  passReqToCallback?: boolean;
}

export interface StrategyOptions extends StrategyOptionsBase {
  passReqToCallback?: false;
}

export interface StrategyOptionsWithRequest extends StrategyOptionsBase {
  passReqToCallback: true;
}

// Mirror the openid-client authenticate options
export interface AuthenticateOptions extends passport.AuthenticateOptions {
  /**
   * OAuth 2.0 Resource Indicator(s) to use for the request either for the
   * authorization request or token endpoint request, depending on whether it's
   * part of {@link Strategy.authenticate} options during the initial redirect or
   * callback phase.
   *
   * This is a request-specific override for {@link StrategyOptions.resource}.
   */
  resource?: string | string[];
  /**
   * Login Hint to use for the authorization request. It is ignored for token
   * endpoint requests.
   */
  loginHint?: string;
  /**
   * ID Token Hint to use for the authorization request. It is ignored for token
   * endpoint requests.
   */
  idTokenHint?: string;
  /**
   * OAuth 2.0 Rich Authorization Requests to use for the authorization request.
   * It is ignored for token endpoint requests.
   *
   * This is a request-specific override for
   * {@link StrategyOptions.authorizationDetails}.
   */
  authorizationDetails?:
    | oidc.AuthorizationDetails
    | oidc.AuthorizationDetails[];
  /**
   * OpenID Connect prompt. This will be used as the `prompt` authorization
   * request parameter unless specified through other means.
   */
  prompt?: string;
  /**
   * OAuth 2.0 scope to use for the authorization request. It is ignored for
   * token endpoint requests.
   *
   * This is a request-specific override for {@link StrategyOptions.scope}.
   */
  scope?: string | string[];
  /**
   * The state option is ignored by this strategy.
   *
   * @deprecated
   */
  state?: never;
  /**
   * OAuth 2.0 redirect_uri to use for the request either for the authorization
   * request or token endpoint request, depending on whether it's part of
   * {@link Strategy.authenticate} options during the initial redirect or
   * callback phase.
   *
   * This is a request-specific override for {@link StrategyOptions.callbackURL}.
   *
   * Note: The option is called "callbackURL" to keep some continuity and
   * familiarity with other oauth-based strategies in the passport ecosystem,
   * namely "passport-oauth2".
   */
  callbackURL?: URL | string;

  // Additional options that might be passed by NestJS/Passport
  successRedirect?: string;
  failureRedirect?: string;
  session?: boolean;
  [key: string]: any;
}

export interface OIDCProviderConfig extends StrategyOptions {
  // provider: string;
  name: string;
  // displayName: string;
  enabled: boolean;
}

export interface NormalizedProfile {
  id: string;
  providerId: number;
  provider: string;
  displayName?: string;
  username?: string;
  name?: string;
  email: string;
  emailVerified: boolean;
  profile?: string;
  picture?: string;
  [claim: string]: JsonValue | undefined;
  raw: UserInfoResponse;
}

export interface OidcTokens {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
}

export interface OidcUser {
  profile: NormalizedProfile;
  claim: OidcTokens;
}

export interface StateData {
  nonce?: string;
  state?: string;
  max_age?: number;
  code_verifier: string;
}

// export interface TokenEndpointResponse {
//   readonly access_token: string;
//   readonly expires_in?: number;
//   readonly id_token?: string;
//   readonly refresh_token?: string;
//   readonly scope?: string;
//   readonly authorization_details?: AuthorizationDetails[];
//   /**
//    * > [!NOTE]\
//    * > Because the value is case insensitive it is always returned lowercased
//    */
//   readonly token_type: 'bearer' | 'dpop' | Lowercase<string>;
//   readonly [parameter: string]: JsonValue | undefined;
// }

export interface OpenIDProfile {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  [key: string]: any;
}

export interface OpenIDTokens {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_at?: number;
  scope?: string;
}

export interface OpenIDStrategyOptions {
  issuer: URL;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope?: string[];
  responseType?: string;
  responseMode?: string;
  prompt?: string;
  // from qwen
  passReqToCallback?: boolean;
  state?: boolean;
  nonce?: boolean;
}

// Extend Profile interface to include OpenID Connect specific fields
// export interface OpenIDConnectProfile extends Profile {
//   idToken?: string;
//   accessToken?: string;
//   refreshToken?: string;
//   expiresIn?: number;
//   idTokenClaims?: Record<string, any>;
// }

// Strategy options interface
// export interface OpenIDConnectStrategyOptions {
//   clientID: string;
//   clientSecret: string;
//   issuer: string;
//   callbackURL: string;
//   scope?: string[];
//   passReqToCallback?: boolean;
//   state?: boolean;
//   nonce?: boolean;
//   responseMode?: string;
// }

// // Strategy state storage interface
// interface StrategyState {
//   state?: string;
//   nonce?: string;
//   providerName: string;
// }
