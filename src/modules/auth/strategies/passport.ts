// import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BaseStrategy } from 'passport-strategy';
import * as oidc from 'openid-client';
import { URLSearchParams } from 'url';
import {
  getDPoPHandle,
  TrustProxyFn,
  VerifyFunction,
  VerifyFunctionWithRequest,
} from 'src/modules/ocid/types/oidc';
import {
  AuthenticateOptions,
  StateData,
  StrategyOptions,
  StrategyOptionsBase,
  StrategyOptionsWithRequest,
  VerifyCallback,
} from 'src/modules/ocid/interfaces/oidc.interface';
import { HttpStatus } from '@nestjs/common';
import { Request } from 'express';

/**
 * A custom, feature-complete Passport strategy for OpenID Connect that aligns with NestJS patterns.
 *
 * This class adapts the logic from `openid-client/passport` to be a flexible, extensible
 * class within the NestJS ecosystem. It supports PAR, JAR, DPoP, and makes key methods
 * overridable for custom behavior.
 */
export class PassportOidcStrategy extends BaseStrategy {
  readonly name: string;
  private readonly _config: oidc.Configuration;
  private readonly _verify: VerifyFunction | VerifyFunctionWithRequest;
  private readonly _callbackURL?: URL;
  private readonly _sessionKey: string;
  private readonly _passReqToCallback?: boolean;
  private readonly _usePAR?: boolean;
  private readonly _useJAR?: StrategyOptions['useJAR'];
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
        'OIDC Strategy requires a valid config from openid-client',
      );
    }
    if (typeof verify !== 'function') {
      throw new TypeError('OIDC Strategy requires a verify function');
    }

    const { host } = new URL(options.config.serverMetadata().issuer);

    this.name = options.name ?? host;
    this._config = options.config;
    this._verify = verify;
    this._sessionKey = options.sessionKey ?? host;
    this._passReqToCallback = options.passReqToCallback;
    this._usePAR = options.usePAR;
    this._useJAR = options.useJAR;
    this._DPoP = (options as StrategyOptionsBase).DPoP;
    this._scope = options.scope;
    this._resource = options.resource;
    this._authorizationDetails = options.authorizationDetails;

    if (options.callbackURL) {
      this._callbackURL = new URL(options.callbackURL.toString());
    }
  }

  authenticate(req: Request, options?: AuthenticateOptions): void {
    if (!req.session) {
      return this.error(
        new Error(
          'OIDC authentication requires session support. Did you forget to use express-session middleware?',
        ),
      );
    }

    const currentUrl = this.currentUrl(req);
    const opts = options ?? {};

    if (this.shouldInitiateAuthRequest(req, currentUrl, opts)) {
      this.authorizationRequest(req, opts).catch((err) =>
        this.error(err instanceof Error ? err : new Error(String(err))),
      );
    } else {
      this.authorizationCodeGrant(req, currentUrl, opts).catch((err) =>
        this.error(err instanceof Error ? err : new Error(String(err))),
      );
    }
  }

  private async authorizationRequest(
    req: Request,
    options: AuthenticateOptions,
  ): Promise<void> {
    try {
      const DPoP = await this._DPoP?.(req);
      const params = this.authorizationRequestParams(req, options);
      const searchParams = new URLSearchParams(
        params as Record<string, string>,
      );

      // PKCE
      const codeVerifier = oidc.randomPKCECodeVerifier();
      searchParams.set(
        'code_challenge',
        await oidc.calculatePKCECodeChallenge(codeVerifier),
      );
      searchParams.set('code_challenge_method', 'S256');

      // Add default strategy options if not overridden in request
      if (this._scope && !searchParams.has('scope'))
        searchParams.set('scope', this._scope);
      if (this._callbackURL && !searchParams.has('redirect_uri'))
        searchParams.set('redirect_uri', this._callbackURL.href);
      if (this._resource && !searchParams.has('resource'))
        this.setResource(searchParams, this._resource);
      if (
        this._authorizationDetails &&
        !searchParams.has('authorization_details')
      )
        this.setAuthorizationDetails(searchParams, this._authorizationDetails);

      let redirectTo = oidc.buildAuthorizationUrl(this._config, searchParams);

      // Nonce & State
      const stateData: StateData = { code_verifier: codeVerifier };
      if (redirectTo.searchParams.get('response_type')?.includes('id_token')) {
        const nonce = oidc.randomNonce();
        redirectTo.searchParams.set('nonce', nonce);
        stateData.nonce = nonce;
      }
      if (
        !this._config.serverMetadata().supportsPKCE() &&
        !redirectTo.searchParams.has('nonce')
      ) {
        const state = oidc.randomState();
        redirectTo.searchParams.set('state', state);
        stateData.state = state;
      }
      const max_age = redirectTo.searchParams.get('max_age');
      if (max_age) {
        stateData.max_age = parseInt(max_age, 10);
      }

      // DPoP
      if (DPoP && !redirectTo.searchParams.has('dpop_jkt')) {
        redirectTo.searchParams.set(
          'dpop_jkt',
          await DPoP.calculateThumbprint(),
        );
      }

      req.session[this._sessionKey] = stateData;

      // JAR
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

      // PAR
      if (this._usePAR) {
        redirectTo = await oidc.buildAuthorizationUrlWithPAR(
          this._config,
          redirectTo.searchParams,
          { DPoP },
        );
      }

      return this.redirect(redirectTo.href);
    } catch (err) {
      return this.error(err as Error);
    }
  }

  private async authorizationCodeGrant(
    req: Request,
    currentUrl: URL,
    options: AuthenticateOptions,
  ): Promise<void> {
    try {
      const stateData: StateData = req.session[this._sessionKey] as StateData;
      delete req.session[this._sessionKey];

      if (!stateData?.code_verifier) {
        return this.fail(
          { message: 'Unable to verify authorization request state.' },
          401,
        );
      }

      const grantParams = this.authorizationCodeGrantParameters(req, options);
      const DPoP = await this._DPoP?.(req);

      const tokens = await oidc.authorizationCodeGrant(
        this._config,
        currentUrl,
        {
          pkceCodeVerifier: stateData.code_verifier,
          expectedNonce: stateData.nonce,
          expectedState: stateData.state,
          maxAge: stateData.max_age,
        },
        grantParams,
        { DPoP },
      );

      const verified: VerifyCallback = (err, user, info) => {
        if (err) return this.error(err);
        if (!user)
          return this.fail(
            info || { message: 'Verification failed' },
            HttpStatus.UNAUTHORIZED,
          );
        return this.success(user, info);
      };

      if (this._passReqToCallback) {
        (this._verify as VerifyFunctionWithRequest)(req, tokens, verified);
      } else {
        (this._verify as VerifyFunction)(tokens, verified);
      }
    } catch (err) {
      if (
        err instanceof oidc.AuthorizationResponseError &&
        err.error === 'access_denied'
      ) {
        return this.fail({ message: err.error_description || err.error }, 401);
      }
      return this.error(err as Error);
    }
  }

  // --- Public Overridable Methods ---

  public shouldInitiateAuthRequest(
    req: Request,
    currentUrl: URL,
    _options: AuthenticateOptions,
  ): boolean {
    return (
      req.method === 'GET' &&
      !currentUrl.searchParams.has('code') &&
      !currentUrl.searchParams.has('error') &&
      !currentUrl.searchParams.has('response')
    );
  }

  public currentUrl(req: Request): URL {
    const protocol = req.protocol;
    const host = req.get('host');
    const url = req.originalUrl || req.url;
    return new URL(`${protocol}://${host}${url}`);
  }

  public authorizationRequestParams(
    req: Request,
    options: AuthenticateOptions,
  ): URLSearchParams | Record<string, string> {
    const params = new URLSearchParams();
    if (options.scope)
      params.set(
        'scope',
        Array.isArray(options.scope) ? options.scope.join(' ') : options.scope,
      );
    if (options.callbackURL)
      params.set('redirect_uri', options.callbackURL.toString());
    if (options.prompt) params.set('prompt', options.prompt);
    if (options.loginHint) params.set('login_hint', options.loginHint);
    if (options.idTokenHint) params.set('id_token_hint', options.idTokenHint);
    if (options.resource) this.setResource(params, options.resource);
    if (options.authorizationDetails)
      this.setAuthorizationDetails(params, options.authorizationDetails);

    params.set('response_type', 'code');
    return params;
  }

  public authorizationCodeGrantParameters(
    req: Request,
    options: AuthenticateOptions,
  ): URLSearchParams | Record<string, string> {
    const params = new URLSearchParams();
    if (options.resource) {
      this.setResource(params, options.resource);
    }
    return params;
  }

  // --- Private Helper Methods ---
  private setResource(params: URLSearchParams, resource: string | string[]) {
    if (Array.isArray(resource)) {
      for (const value of resource) {
        params.append('resource', value);
      }
    } else {
      params.set('resource', resource);
    }
  }

  private setAuthorizationDetails(
    params: URLSearchParams,
    authDetails: oidc.AuthorizationDetails | oidc.AuthorizationDetails[],
  ) {
    const value = Array.isArray(authDetails) ? authDetails : [authDetails];
    params.set('authorization_details', JSON.stringify(value));
  }
}

// src/auth/strategies/nest-oidc.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as PassportBaseStrategy } from 'passport-strategy';

// import { Strategy as PassportStrategy } from '@nestjs/passport';
// import { Injectable, Logger } from '@nestjs/common';
import {
  //   AuthenticateOptions,
  Strategy as OidcClientStrategy,
} from 'openid-client/passport';
import { VerifiedCallback } from 'passport-jwt';

@Injectable()
export class OidcStrategy extends PassportStrategy('oidc') {
  private readonly logger = new Logger(OidcStrategy.name);
  private oidcStrategy: OidcClientStrategy;
  private config: oidc.Configuration;

  constructor(private readonly options: StrategyOptions) {
    super();
    this.initializeStrategy();
  }

  private async initializeStrategy() {
    try {
      this.config = await oidc.discovery(
        new URL(this.options.issuer),
        this.options.clientID,
        this.options.clientSecret,
      );

      const strategyOptions: oidc.StrategyOptions = {
        config: this.config,
        name: this.options.name,
        sessionKey: this.options.sessionKey,
        callbackURL: this.options.callbackURL,
        scope: this.options.scope,
        passReqToCallback: this.options.passReqToCallback || false,
      };

      this.oidcStrategy = new OidcClientStrategy(
        strategyOptions,
        this.handleVerify.bind(this),
      );
    } catch (error) {
      this.logger.error('Failed to initialize OIDC strategy', error);
      throw error;
    }
  }

  async authenticate(
    req: Request,
    options?: AuthenticateOptions,
  ): Promise<void> {
    if (!this.oidcStrategy) {
      this.error(new Error('OIDC strategy not initialized'));
      return;
    }

    // Delegate to the openid-client strategy
    this.oidcStrategy.authenticate(req, options);
  }

  private async handleVerify(
    tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
    done: VerifiedCallback,
  ): Promise<void> {
    try {
      // Your verification logic here
      const user = await this.validate(tokens);
      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }

  async validate(
    tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  ): Promise<any> {
    // Implement your validation logic
    // This should return the user object or throw an error
    const claims = tokens.claims();

    if (!claims?.sub) {
      throw new Error('ID token "sub" claim is missing');
    }

    // Fetch user info if needed
    const userInfo = await oidc.fetchUserInfo(
      this.config,
      tokens.access_token,
      claims.sub,
    );

    return {
      id: claims.sub,
      email: userInfo.email,
      name: userInfo.name,
      // Add other user properties as needed
    };
  }

  // Override PassportStrategy methods to ensure they're available
  success(user: any, info?: any): void {
    super.success(user, info);
  }

  fail(challenge: any, status: number): void;
  fail(status: number): void;
  fail(challenge: any, status?: number): void {
    if (typeof challenge === 'number') {
      super.fail(challenge);
    } else {
      super.fail(challenge, status!);
    }
  }

  redirect(url: string, status?: number): void {
    super.redirect(url, status);
  }

  error(err: Error): void {
    super.error(err);
  }
}

/**
 * A Nest-compatible OIDC strategy that uses openid-client low-level functions.
 * It mirrors the important behaviour of openid-client/passport but written here
 * so we can implement stricter typing and integrate smoothly with Nest.
 */
@Injectable()
export class NestOidcStrategy extends PassportStrategy(
  PassportBaseStrategy,
  'nest-oidc',
) {
  validate(...args: any[]): unknown {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(NestOidcStrategy.name);

  public name: string;
  private _config: oidc.Configuration;
  private _sessionKey: string;
  private _callbackURL?: URL;
  private _scope?: string;
  private _passReqToCallback?: boolean;
  private _DPoP?: (
    req: Request,
  ) => Promise<oidc.DPoPHandle | undefined> | oidc.DPoPHandle | undefined;
  private _usePAR?: boolean;
  private _useJAR?: any;

  private _verify: VerifyFunction;

  constructor(
    config: oidc.Configuration,
    options: StrategyOptions,
    verify: VerifyFunction,
    // optional extra dependencies (e.g. AuthService) can be injected via factory
  ) {
    // call super() with no args (we implement authenticate)
    super();
    if (!(config instanceof oidc.Configuration)) {
      throw new TypeError('config must be an instance of oidc.Configuration');
    }
    if (typeof verify !== 'function') {
      throw new TypeError('verify must be a function');
    }

    this._config = config;
    this.name = options.name ?? new URL(config.serverMetadata().issuer).host;
    this._sessionKey = options.sessionKey ?? this.name;
    this._callbackURL = options.callbackURL
      ? new URL(String(options.callbackURL))
      : undefined;
    this._scope = options.scope;
    this._passReqToCallback = options.passReqToCallback;
    this._verify = verify;

    // If you need DPoP/JAR/PAR options, set them here from options
    // this._DPoP = options.DPoP
    // this._usePAR = options.usePAR
    // this._useJAR = options.useJAR
  }

  // ---------- Small helpers (mirrors openid-client/passport) ----------

  private host(req: Request): string | undefined {
    try {
      const trust = req.app.get('trust proxy fn') as TrustProxyFn;
      let val = req.get('x-forwarded-host');
      if (!val || !trust(req.socket.remoteAddress, 0)) {
        val = req.get('host');
      } else if (val.indexOf(',') !== -1) {
        val = val.substring(0, val.indexOf(',')).trimEnd();
      }
      return val || undefined;
    } catch {
      return req.host;
    }
  }

  currentUrl(req: Request): URL {
    // This is the default behaviour used by openid-client/passport
    return new URL(
      `${req.protocol}://${this.host(req)}${req.originalUrl ?? req.url}`,
    );
  }

  private shouldInitiateAuthRequest(req: Request, currentUrl: URL): boolean {
    // default behaviour: GET and no code/error/response params => initial auth
    return (
      req.method === 'GET' &&
      !currentUrl.searchParams.has('code') &&
      !currentUrl.searchParams.has('error') &&
      !currentUrl.searchParams.has('response')
    );
  }

  // ---------- Core authorize request (redirect to IdP) ----------
  private async authorizationRequest<TOptions extends AuthenticateOptions>(
    req: Request,
    opts: TOptions,
  ) {
    let redirectTo = oidc.buildAuthorizationUrl(
      this._config,
      new URLSearchParams(opts?.authorizationParams ?? {}),
    );

    // ensure nonce if id_token present
    if (redirectTo.searchParams.get('response_type')?.includes('id_token')) {
      redirectTo.searchParams.set('nonce', oidc.randomNonce());
      if (!redirectTo.searchParams.has('response_mode')) {
        redirectTo.searchParams.set('response_mode', 'form_post');
      }
    }

    // PKCE
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const code_challenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    redirectTo.searchParams.set('code_challenge', code_challenge);
    redirectTo.searchParams.set('code_challenge_method', 'S256');

    // set redirect_uri if callbackURL provided
    if (this._callbackURL && !redirectTo.searchParams.has('redirect_uri')) {
      redirectTo.searchParams.set('redirect_uri', this._callbackURL.href);
    }

    // set default scope if not provided
    if (this._scope && !redirectTo.searchParams.has('scope')) {
      redirectTo.searchParams.set('scope', this._scope);
    }

    // state data stored in session
    const sessionKey = this._sessionKey;
    const stateData: StateData = { code_verifier: codeVerifier };
    if (redirectTo.searchParams.has('nonce'))
      stateData.nonce = redirectTo.searchParams.get('nonce');
    if (redirectTo.searchParams.has('state'))
      stateData.state = redirectTo.searchParams.get('state');
    if (redirectTo.searchParams.has('max_age'))
      stateData.max_age = Number(redirectTo.searchParams.get('max_age'));

    req.session = req.session ?? {};
    req.session[sessionKey] = stateData;

    // if PAR/JAR/DPoP support needed, you can add similar blocks as in official
    // strategy (omitted for brevity).

    // finally redirect
    this.redirect(redirectTo.href);
  }

  // ---------- Core callback handling (code -> tokens -> verify) ----------
  private async authorizationCodeGrant<TOptions extends AuthenticateOptions>(
    req: Request,
    currentUrl: URL,
    opts?: TOptions,
  ) {
    const sessionKey = this._sessionKey;
    const stateData: StateData = req.session[sessionKey] as StateData;

    if (!stateData?.code_verifier) {
      return this.fail(
        {
          message: 'Unable to verify authorization request state',
        },
        401,
      );
    }

    // If explicit callbackURL was supplied in options, merge query params into it (mirrors upstream)
    if (opts?.callbackURL || this._callbackURL) {
      const _currentUrl = new URL(opts?.callbackURL ?? this._callbackURL!.href);
      for (const [k, v] of currentUrl.searchParams.entries()) {
        _currentUrl.searchParams.append(k, v);
      }
      currentUrl = _currentUrl;
    }

    // Build input for token exchange. openid-client supports passing a URL or Request object
    let input: URL | Request = currentUrl;
    // support POST response_mode=form_post (similar to upstream)
    if (req.method === 'POST') {
      input = new Request(currentUrl.href, {
        method: 'POST',
        headers: Object.entries(
          (req as any).headersDistinct ?? req.headers,
        ).reduce((acc, [key, values]) => {
          // keep simple: append header values
          if (Array.isArray(values)) {
            for (const v of values) acc.append(key, v as any);
          } else if (values) acc.append(key, String(values));
          return acc;
        }, new Headers()),
        // @ts-ignore
        body: req,
        duplex: 'half',
      });
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
      opts?.tokenEndpointParams,
      { DPoP: await this._DPoP?.(req) },
    );

    // Now call verify: we must make sure we convert unknown failures into Error instances
    const done: VerifyCallback = (err, user, info) => {
      if (err) return this.error(err);
      if (!user) return this.fail(info ?? {}, 401);
      return this.success(user);
    };

    try {
      if (this._passReqToCallback || opts?.passReqToCallback) {
        // verify may be sync or return Promise
        await (
          this._verify as (
            req: Request,
            t: typeof tokens,
            d: VerifyCallback,
          ) => any
        )(req, tokens, done);
      } else {
        await (this._verify as (t: typeof tokens, d: VerifyCallback) => any)(
          tokens,
          done,
        );
      }
    } catch (err: unknown) {
      // convert unknown to Error before calling done / this.error
      const e =
        err instanceof Error
          ? err
          : new Error(String(err ?? 'Unknown error in verify'));
      // call done with Error to follow passport convention
      done(e);
    }
  }

  // ---------- Passport core method ----------
  authenticate(req: Request, options?: any) {
    try {
      if (!(req as any).session) {
        return this.error(
          new Error(
            'OAuth 2.0 authentication requires session support. Did you forget to use express-session middleware?',
          ),
        );
      }

      let currentUrl = this.currentUrl(req);

      if (this.shouldInitiateAuthRequest(req, currentUrl)) {
        // start auth redirect
        this.authorizationRequest(req, options).catch((err) => {
          const e =
            err instanceof Error
              ? err
              : new Error(String(err ?? 'Unknown auth request error'));
          this.error(e);
        });
      } else {
        // handle callback
        this.authorizationCodeGrant(req, currentUrl, options).catch((err) => {
          const e =
            err instanceof Error
              ? err
              : new Error(String(err ?? 'Unknown grant error'));
          this.error(e);
        });
      }
    } catch (err: unknown) {
      const e =
        err instanceof Error
          ? err
          : new Error(String(err ?? 'Unknown strategy error'));
      this.error(e);
    }
  }
}
