import { Strategy as PassportStrategy } from 'passport-strategy';
import { Request } from 'express';
import * as oidc from 'openid-client';
// import { randomBytes, createHash } from 'crypto';
import {
  AuthenticateOptions,
  StateData,
  StrategyOptions,
  StrategyOptionsBase,
  StrategyOptionsWithRequest,
  VerifyCallback,
} from '../interfaces/oidc.interface';
import { HttpStatus } from '@nestjs/common';
import { DuplexRequestInit } from 'src/types/express';
import {
  TrustProxyFn,
  VerifyFunction,
  VerifyFunctionWithRequest,
} from '../types/oidc';

export class OidcStrategy extends PassportStrategy {
  /**
   * Name of the strategy
   */
  readonly name: string;
  /**
   * @internal
   */
  _config: StrategyOptionsBase['config'];
  /**
   * @internal
   */
  _verify: VerifyFunction | VerifyFunctionWithRequest;
  /**
   * @internal
   */
  _callbackURL: Exclude<StrategyOptionsBase['callbackURL'], string>;
  /**
   * @internal
   */
  _sessionKey: NonNullable<StrategyOptionsBase['sessionKey']>;
  /**
   * @internal
   */
  _passReqToCallback: StrategyOptionsBase['passReqToCallback'];
  /**
   * @internal
   */
  _usePAR: StrategyOptionsBase['usePAR'];
  /**
   * @internal
   */
  _useJAR: StrategyOptionsBase['useJAR'];
  /**
   * @internal
   */
  _DPoP: StrategyOptionsBase['DPoP'];
  /**
   * @internal
   */
  _scope: StrategyOptionsBase['scope'];
  /**
   * @internal
   */
  _resource: StrategyOptionsBase['resource'];
  /**
   * @internal
   */
  _authorizationDetails: StrategyOptionsBase['authorizationDetails'];

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
   * [Strategy method] Return additional authorization request parameters.
   *
   * This method is intended to be overloaded if additional parameters need to
   * be included an authorization request are needed.
   *
   * By default this method takes care of adding the corresponding authorization
   * endpoint parameters when
   * {@link AuthenticateOptions.authorizationDetails authorizationDetails},
   * {@link AuthenticateOptions.idTokenHint idTokenHint},
   * {@link AuthenticateOptions.loginHint loginHint},
   * {@link AuthenticateOptions.prompt prompt},
   * {@link AuthenticateOptions.resource resource}, or
   * {@link AuthenticateOptions.scope scope} properties of
   * {@link AuthenticateOptions} are used.
   *
   * @param req
   * @param options This is the value originally passed to
   *   `passport.authenticate()` as its `options` argument.
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
   * [Strategy method] Return additional token endpoint request parameters.
   *
   * This method is intended to be overloaded if additional parameters to be
   * included in the authorization code grant token endpoint request are
   * needed.
   *
   * By default this method takes care of adding the `resource` token endpoint
   * parameters when {@link AuthenticateOptions.resource} is used.
   *
   * @param req
   * @param options This is the value originally passed to
   *   `passport.authenticate()` as its `options` argument.
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
   * @private
   * Private method to handle authorization request initiation
   * @internal
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
        redirectTo.searchParams.set('nonce', oidc.randomNonce());

        if (!redirectTo.searchParams.has('response_mode')) {
          redirectTo.searchParams.set('response_mode', 'form_post');
        }
      }

      // PKCE implementation
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      redirectTo.searchParams.set('code_challenge', codeChallenge);
      redirectTo.searchParams.set('code_challenge_method', 'S256');

      // State parameter for non-PKCE flows
      if (
        !this._config.serverMetadata().supportsPKCE() &&
        !redirectTo.searchParams.has('nonce')
      ) {
        redirectTo.searchParams.set('state', oidc.randomState());
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

  /**
   * [Strategy method] Return the current request URL.
   *
   * This method is intended to be overloaded if its return value does not match
   * the actual URL the authorization server redirected the user to.
   *
   * - Its `searchParams` are used as the authorization response parameters when
   *   the authorization response request is a GET.
   * - Its resulting `href` value (after stripping its `searchParams` and `hash`)
   *   is used as the `redirect_uri` authorization code grant token endpoint
   *   parameter unless {@link AuthenticateOptions.callbackURL}, or
   *   {@link StrategyOptionsBase.callbackURL} are used in which case those are
   *   used as the `redirect_uri` parameter instead.
   *
   * Default is
   *
   * ```ts
   * function currentUrl(req: express.Request): URL {
   *   return new URL(
   *     `${req.protocol}://${req.host}${req.originalUrl ?? req.url}`,
   *   )
   * }
   * ```
   *
   * When behind a reverse proxy it assumes common proxy headers are in use and
   * that
   * {@link https://expressjs.com/en/guide/behind-proxies.html Express (behind proxies docs)},
   * or
   * {@link https://fastify.dev/docs/latest/Reference/Server/#trustproxy Fastify (trustProxy docs)}
   * are properly configured to trust them.
   */
  private currentUrl(req: Request): URL {
    return new URL(
      `${req.protocol}://${this.getHost(req)}${req.originalUrl ?? req.url}`,
    );
  }

  /**
   * [Strategy method] Determine whether to initiate an authorization request.
   *
   * This method is intended to be overloaded if custom logic for determining
   * whether to initiate an authorization request or process an authorization
   * response.
   *
   * By default, this method returns `true` when the request method is GET and
   * the current URL does not contain `code`, `error`, or `response` query
   * parameters, indicating that this is an initial authorization request rather
   * than a callback from the authorization server.
   *
   * @param req
   * @param currentUrl The current request URL as determined by
   *   {@link Strategy.currentUrl}
   * @param _options This is the value originally passed to
   *   `passport.authenticate()` as its `options` argument.
   */
  shouldInitiateAuthRequest<TOptions extends AuthenticateOptions>(
    req: Request,
    currentUrl: URL,
    _options: TOptions,
  ): boolean {
    return (
      req.method === 'GET' &&
      !currentUrl.searchParams.has('code') &&
      !currentUrl.searchParams.has('error') &&
      !currentUrl.searchParams.has('response')
    );
  }

  /**
   * [Passport method] Authenticate the request.
   */
  authenticate(req: Request, options: AuthenticateOptions = {}): void {
    if (!req.session) {
      return this.error(
        new Error(
          'OAuth 2.0 authentication requires session support. Did you forget to use express-session middleware?',
        ),
      );
    }

    const currentUrl = this.currentUrl(req);

    // if (this.shouldInitiateAuthRequest(req, currentUrl, options)) {
    //   this.authorizationRequest(req, options);
    // } else {
    //   this.authorizationCodeGrant(req, currentUrl, options);
    // }

    if (this.shouldInitiateAuthRequest(req, currentUrl, options)) {
      this.authorizationRequest(req, options).catch((err) =>
        this.error(err instanceof Error ? err : new Error(String(err))),
      );
    } else {
      this.authorizationCodeGrant(req, currentUrl, options).catch((err) =>
        this.error(err instanceof Error ? err : new Error(String(err))),
      );
    }
  }

  /* ========== Helper methods ========== */

  /**
   * Taken from express@5 req.host implementation to get around the fact that
   * req.host in express@4 is not the host but hostname. Catches errors stemming
   * from possibly not using express and returns req.host for compatibility with
   * e.g. fastify-express.
   */
  private getHost(req: Request): string {
    try {
      const trust = req.app.get('trust proxy fn') as unknown as TrustProxyFn;
      let val = req.get('x-forwarded-host');

      if (!val || !trust(req.socket.remoteAddress ?? '', 0)) {
        // if (!val || !trust?.(req, 0)) {
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
}
