import { Strategy as PassportStrategy } from 'passport-strategy';
import { Request } from 'express';
import * as oidc from 'openid-client';
import { randomBytes, createHash } from 'crypto';
import passport from 'passport';
import { StateData } from '../interfaces/oidc.interface';
import { HttpStatus } from '@nestjs/common';
import { DuplexRequestInit } from 'src/types/express';
import { TrustProxyFn } from '../types/oidc';

// Type-safe callback interface for NestJS (replacing passport.AuthenticateCallback)
export interface VerifyCallback {
  (
    error: Error | false | null,
    user?: Express.User | false,
    info?: object | string | Array<string | undefined>,
    status?: number | Array<number | undefined>,
  ): void;
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

// DPoP handle function type
export type getDPoPHandle = (
  req: Request,
) => Promise<oidc.DPoPHandle | undefined> | oidc.DPoPHandle | undefined;

export interface StrategyOptions extends StrategyOptionsBase {
  passReqToCallback?: false;
}

export interface StrategyOptionsWithRequest extends StrategyOptionsBase {
  passReqToCallback: true;
}

// Base strategy options interface
interface StrategyOptionsBase {
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
    | oidc.CryptoKey
    | oidc.PrivateKey
    | [oidc.CryptoKey | oidc.PrivateKey, oidc.ModifyAssertionFunction];
  /**
   * Whether the verify function should get the `req` as first argument instead.
   * Default is `false`.
   */
  passReqToCallback?: boolean;
}

// Verify function types
export type VerifyFunction = (
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  done: VerifyCallback,
) => void;

export type VerifyFunctionWithRequest = (
  req: Request,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  done: VerifyCallback,
) => void;

export class OidcStrategy extends PassportStrategy {
  readonly name: string;
  private readonly _config: oidc.Configuration;
  private readonly _verify: VerifyFunction | VerifyFunctionWithRequest;
  private readonly _callbackURL?: URL;
  private readonly _sessionKey: string;
  private readonly _passReqToCallback: boolean;
  private readonly _usePAR: boolean;
  private readonly _useJAR: StrategyOptionsBase['useJAR'];
  private readonly _DPoP?: getDPoPHandle;
  private readonly _scope?: string;
  private readonly _resource?: string | string[];
  private readonly _authorizationDetails?:
    | oidc.AuthorizationDetails
    | oidc.AuthorizationDetails[];

  constructor(options: StrategyOptions, verify: VerifyFunction);
  constructor(
    options: StrategyOptionsWithRequest,
    verify: VerifyFunctionWithRequest,
  );
  constructor(
    options: StrategyOptions | StrategyOptionsWithRequest,
    verify: VerifyFunction | VerifyFunctionWithRequest,
  ) {
    super();

    if (!(options?.config instanceof oidc.Configuration)) {
      throw new TypeError(
        'OIDC Strategy requires a valid openid-client Configuration',
      );
    }

    if (typeof verify !== 'function') {
      throw new TypeError('OIDC Strategy requires a verify function');
    }

    const { host } = new URL(options.config.serverMetadata().issuer);

    this.name = options.name ?? host;
    this._sessionKey = options.sessionKey ?? host;
    this._DPoP = options.DPoP;
    this._config = options.config;
    this._scope = options.scope;
    this._useJAR = options.useJAR ?? false;
    this._usePAR = options.usePAR ?? false;
    this._verify = verify;

    if (options.callbackURL) {
      this._callbackURL = new URL(options.callbackURL);
    }

    this._passReqToCallback = options.passReqToCallback ?? false;
    this._resource = options.resource;
    this._authorizationDetails = options.authorizationDetails;
  }

  /**
   * Return additional authorization request parameters.
   * This mirrors the openid-client strategy's method signature.
   */
  authorizationRequestParams<TOptions extends AuthenticateOptions>(
    req: Request,
    options: TOptions,
  ): URLSearchParams | Record<string, string> | undefined {
    const params = new URLSearchParams();

    if (options?.scope) {
      if (Array.isArray(options.scope) && options.scope.length) {
        params.set('scope', options.scope.join(' '));
      } else if (typeof options.scope === 'string' && options.scope.length) {
        params.set('scope', options.scope);
      }
    }

    if (options?.prompt) {
      params.set('prompt', options.prompt);
    }

    if (options?.loginHint) {
      params.set('login_hint', options.loginHint);
    }

    if (options?.idTokenHint) {
      params.set('id_token_hint', options.idTokenHint);
    }

    if (options?.resource) {
      this.setResourceParams(params, options.resource);
    }

    if (options?.authorizationDetails) {
      this.setAuthorizationDetailsParams(params, options.authorizationDetails);
    }

    if (options?.callbackURL) {
      params.set('redirect_uri', new URL(options.callbackURL).href);
    }

    return params;
  }

  /**
   * Return additional token endpoint request parameters.
   * This mirrors the openid-client strategy's method signature.
   */
  authorizationCodeGrantParameters<TOptions extends AuthenticateOptions>(
    req: Request,
    options: TOptions,
  ): URLSearchParams | Record<string, string> | undefined {
    const params = new URLSearchParams();

    if (options?.resource) {
      this.setResourceParams(params, options.resource);
    }

    return params;
  }

  /**
   * Return the current request URL.
   * This mirrors the openid-client strategy's method signature.
   */
  currentUrl(req: Request): URL {
    return new URL(
      `${req.protocol}://${this.getHost(req)}${req.originalUrl ?? req.url}`,
    );
  }

  /**
   * Determine whether to initiate an authorization request.
   * This mirrors the openid-client strategy's method signature.
   */
  shouldInitiateAuthRequest<TOptions extends AuthenticateOptions>(
    req: Request,
    currentUrl: URL,
    options: TOptions,
  ): boolean {
    return (
      req.method === 'GET' &&
      !currentUrl.searchParams.has('code') &&
      !currentUrl.searchParams.has('error') &&
      !currentUrl.searchParams.has('response')
    );
  }

  /**
   * Main authenticate method - this is called by Passport
   */
  authenticate(req: Request, options: AuthenticateOptions = {}): void {
    if (!req.session) {
      return this.error(
        new Error('OIDC authentication requires session support'),
      );
    }

    const currentUrl = this.currentUrl(req);

    if (this.shouldInitiateAuthRequest(req, currentUrl, options)) {
      this.authorizationRequest(req, options);
    } else {
      this.authorizationCodeGrant(req, currentUrl, options);
    }
  }

  /**
   * Private method to handle authorization request initiation
   */
  private async authorizationRequest<TOptions extends AuthenticateOptions>(
    req: Request,
    options: TOptions,
  ): Promise<void> {
    try {
      let redirectTo = oidc.buildAuthorizationUrl(
        this._config,
        new URLSearchParams(this.authorizationRequestParams(req, options)),
      );

      // Handle implicit flow with ID tokens
      if (redirectTo.searchParams.get('response_type')?.includes('id_token')) {
        redirectTo.searchParams.set('nonce', this.randomNonce());

        if (!redirectTo.searchParams.has('response_mode')) {
          redirectTo.searchParams.set('response_mode', 'form_post');
        }
      }

      // PKCE implementation
      const codeVerifier = this.randomPKCECodeVerifier();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      redirectTo.searchParams.set('code_challenge', codeChallenge);
      redirectTo.searchParams.set('code_challenge_method', 'S256');

      // State parameter for non-PKCE flows
      if (
        !this._config.serverMetadata().supportsPKCE() &&
        !redirectTo.searchParams.has('nonce')
      ) {
        redirectTo.searchParams.set('state', this.randomState());
      }

      // Set callback URL
      if (this._callbackURL && !redirectTo.searchParams.has('redirect_uri')) {
        redirectTo.searchParams.set('redirect_uri', this._callbackURL.href);
      }

      // Set default scope
      if (this._scope && !redirectTo.searchParams.has('scope')) {
        redirectTo.searchParams.set('scope', this._scope);
      }

      // Set resource parameters
      if (this._resource && !redirectTo.searchParams.has('resource')) {
        this.setResourceParams(redirectTo.searchParams, this._resource);
      }

      // Set authorization details
      if (
        this._authorizationDetails &&
        !redirectTo.searchParams.has('authorization_details')
      ) {
        this.setAuthorizationDetailsParams(
          redirectTo.searchParams,
          this._authorizationDetails,
        );
      }

      // DPoP support
      const DPoP = await this._DPoP?.(req);
      if (DPoP && !redirectTo.searchParams.has('dpop_jkt')) {
        redirectTo.searchParams.set(
          'dpop_jkt',
          await DPoP.calculateThumbprint(),
        );
      }

      // Store state data in session
      const stateData: StateData = { code_verifier: codeVerifier };

      const nonce = redirectTo.searchParams.get('nonce');
      if (nonce) stateData.nonce = nonce;

      const state = redirectTo.searchParams.get('state');
      if (state) stateData.state = state;

      const maxAge = redirectTo.searchParams.get('max_age');
      if (maxAge) stateData.max_age = parseInt(maxAge, 10);

      req.session[this._sessionKey] = stateData;

      // Handle JAR (JWT Assertion Request)
      // if (this._useJAR && this._useJAR !== false) {
      if (this._useJAR) {
        let key: oidc.CryptoKey | oidc.PrivateKey;
        let modifyAssertion: oidc.ModifyAssertionFunction | undefined;

        if (Array.isArray(this._useJAR)) {
          [key, modifyAssertion] = this._useJAR;
        } else {
          key = this._useJAR;
        }

        redirectTo = await oidc.buildAuthorizationUrlWithJAR(
          this._config,
          redirectTo.searchParams,
          key,
          { [oidc.modifyAssertion]: modifyAssertion },
        );
      }

      // Handle PAR (Pushed Authorization Request)
      if (this._usePAR) {
        redirectTo = await oidc.buildAuthorizationUrlWithPAR(
          this._config,
          redirectTo.searchParams,
          { DPoP },
        );
      }

      return this.redirect(redirectTo.href);
    } catch (err) {
      return this.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Private method to handle authorization code grant
   */
  private async authorizationCodeGrant<TOptions extends AuthenticateOptions>(
    req: Request,
    currentUrl: URL,
    options: TOptions,
  ): Promise<void> {
    try {
      const stateData: StateData = req.session[this._sessionKey] as StateData;

      if (!stateData?.code_verifier) {
        return this.fail(
          {
            message: 'Unable to verify authorization request state',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Handle callback URL override
      if (options.callbackURL || this._callbackURL) {
        const _currentUrl = new URL(options.callbackURL || this._callbackURL!);
        for (const [k, v] of currentUrl.searchParams.entries()) {
          _currentUrl.searchParams.append(k, v);
        }
        currentUrl = _currentUrl;
      }

      // Handle POST requests (form_post response mode)
      let input: URL | globalThis.Request = currentUrl;
      if (req.method === 'POST') {
        const headers = new Headers();
        if (req.headers) {
          Object.entries(req.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((v) => headers.append(key, v));
            } else if (value) {
              headers.append(key, value);
            }
          });
        }

        input = this.expressToUndiciRequest(req, currentUrl);
      }

      // Exchange code for tokens
      const tokens = await oidc.authorizationCodeGrant(
        this._config,
        input,
        {
          pkceCodeVerifier: stateData.code_verifier,
          expectedNonce: stateData.nonce,
          expectedState: stateData.state,
          maxAge: stateData.max_age,
        },
        this.authorizationCodeGrantParameters(req, options),
        { DPoP: await this._DPoP?.(req) },
      );

      // Create type-safe verified callback
      const verified: VerifyCallback = (err, user, info) => {
        if (err) return this.error(err);
        if (!user)
          return this.fail(
            info || { message: 'Authentication failed' },
            HttpStatus.UNAUTHORIZED,
          );
        return this.success(user);
      };

      // Call verify function
      if (options.passReqToCallback ?? this._passReqToCallback) {
        return (this._verify as VerifyFunctionWithRequest)(
          req,
          tokens,
          verified,
        );
      }

      return (this._verify as VerifyFunction)(tokens, verified);
    } catch (err) {
      if (
        err instanceof oidc.AuthorizationResponseError &&
        err.error === 'access_denied'
      ) {
        return this.fail(
          {
            message: err.error_description || err.error,
            ...Object.fromEntries(err.cause.entries()),
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      return this.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Helper methods
  /**
   * Taken from express@5 req.host implementation to get around the fact that
   * req.host in express@4 is not the host but hostname. Catches errors stemming
   * from possibly not using express and returns req.host for compatibility with
   * e.g. fastify-express.
   */
  private getHost(req: Request): string {
    try {
      const trust = req.app?.get<unknown>('trust proxy fn');
      let val = req.get('x-forwarded-host');

      // if (!val || !trust?.(req.socket?.remoteAddress, 0)) {
      if (!val || !trust?.(req, 0)) {
        val = req.get('host');
      } else if (val.indexOf(',') !== -1) {
        val = val.substring(0, val.indexOf(',')).trimEnd();
      }

      return val || req.headers.host || 'localhost';
    } catch {
      return req.headers.host || 'localhost';
    }
  }

  private setResourceParams(
    params: URLSearchParams,
    resource: string | string[],
  ): void {
    if (Array.isArray(resource)) {
      resource.forEach((value) => params.append('resource', value));
    } else {
      params.set('resource', resource);
    }
  }

  private setAuthorizationDetailsParams(
    params: URLSearchParams,
    authorizationDetails:
      | oidc.AuthorizationDetails
      | oidc.AuthorizationDetails[],
  ): void {
    if (Array.isArray(authorizationDetails)) {
      params.set('authorization_details', JSON.stringify(authorizationDetails));
    } else {
      params.set(
        'authorization_details',
        JSON.stringify([authorizationDetails]),
      );
    }
  }

  private randomNonce(): string {
    return randomBytes(16).toString('base64url');
  }

  private randomState(): string {
    return randomBytes(16).toString('base64url');
  }

  private randomPKCECodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  // private async calculatePKCECodeChallenge(
  //   codeVerifier: string,
  // ): Promise<string> {
  //   return createHash('sha256').update(codeVerifier).digest('base64url');
  // }

  private expressToUndiciRequest(
    req: Request,
    targetUrl: URL,
  ): globalThis.Request {
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value !== undefined) {
        headers.append(key, value);
      }
    }

    const init: DuplexRequestInit = {
      method: req.method,
      headers,
      duplex: 'half',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = this.nodeStreamToWeb(req);
    }

    return new Request(targetUrl.href, init);
  }

  private nodeStreamToWeb(
    nodeStream: NodeJS.ReadableStream,
  ): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err: unknown) => {
          // controller.error is safe to call with unknown
          controller.error(err);
        });
      },
      cancel() {
        // No .destroy() here — just stop reading
        nodeStream.pause();
      },
    });
  }

  private async *toUint8(
    src: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): AsyncIterable<Uint8Array> {
    for await (const chunk of src) {
      // Force to plain Uint8Array
      yield new Uint8Array(chunk);
    }
  }
}

export function expressToFetchRequest(
  req: Request,
  targetUrl: URL,
): globalThis.Request {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else if (value !== undefined) {
      headers.append(key, value);
    }
  }

  const init: DuplexRequestInit = {
    method: req.method,
    headers,
    duplex: 'half',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Explicitly assert to NodeJS.ReadableStream so TS accepts it as BodyInit
    init.body = req as unknown as ReadableStream;
  }

  return new Request(targetUrl.href, init);
}
