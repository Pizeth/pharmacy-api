// import { Strategy as PassportStrategy } from 'passport-strategy';
// import { Request } from 'express';
// import * as oidc from 'openid-client';
// import { randomBytes, createHash } from 'crypto';

// // Type-safe callback interface for NestJS (replacing passport.AuthenticateCallback)
// export interface OidcVerifyCallback {
//   (error: Error | null, user?: Express.User | false, info?: any): void;
// }

// // Mirror the openid-client authenticate options
// export interface OidcAuthenticateOptions {
//   resource?: string | string[];
//   loginHint?: string;
//   idTokenHint?: string;
//   authorizationDetails?:
//     | oidc.AuthorizationDetails
//     | oidc.AuthorizationDetails[];
//   prompt?: string;
//   scope?: string | string[];
//   callbackURL?: URL | string;
//   // Additional options that might be passed by NestJS/Passport
//   successRedirect?: string;
//   failureRedirect?: string;
//   session?: boolean;
//   [key: string]: any;
// }

// // DPoP handle function type
// export type GetDPoPHandle = (
//   req: Request,
// ) => Promise<oidc.DPoPHandle | undefined> | oidc.DPoPHandle | undefined;

// // Base strategy options interface
// interface OidcStrategyOptionsBase {
//   config: oidc.Configuration;
//   name?: string;
//   sessionKey?: string;
//   DPoP?: GetDPoPHandle;
//   callbackURL?: URL | string;
//   scope?: string;
//   authorizationDetails?:
//     | oidc.AuthorizationDetails
//     | oidc.AuthorizationDetails[];
//   resource?: string | string[];
//   usePAR?: boolean;
//   useJAR?:
//     | false
//     | oidc.CryptoKey
//     | oidc.PrivateKey
//     | [oidc.CryptoKey | oidc.PrivateKey, oidc.ModifyAssertionFunction];
//   passReqToCallback?: boolean;
// }

// export interface OidcStrategyOptions extends OidcStrategyOptionsBase {
//   passReqToCallback?: false;
// }

// export interface OidcStrategyOptionsWithRequest
//   extends OidcStrategyOptionsBase {
//   passReqToCallback: true;
// }

// // Verify function types
// export type OidcVerifyFunction = (
//   tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
//   done: OidcVerifyCallback,
// ) => void;

// export type OidcVerifyFunctionWithRequest = (
//   req: Request,
//   tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
//   done: OidcVerifyCallback,
// ) => void;

// interface StateData {
//   nonce?: string;
//   state?: string;
//   max_age?: number;
//   code_verifier: string;
// }

// export class OidcStrategy extends PassportStrategy {
//   readonly name: string;
//   private readonly _config: oidc.Configuration;
//   private readonly _verify: OidcVerifyFunction | OidcVerifyFunctionWithRequest;
//   private readonly _callbackURL?: URL;
//   private readonly _sessionKey: string;
//   private readonly _passReqToCallback: boolean;
//   private readonly _usePAR: boolean;
//   private readonly _useJAR: OidcStrategyOptionsBase['useJAR'];
//   private readonly _DPoP?: GetDPoPHandle;
//   private readonly _scope?: string;
//   private readonly _resource?: string | string[];
//   private readonly _authorizationDetails?:
//     | oidc.AuthorizationDetails
//     | oidc.AuthorizationDetails[];

//   constructor(options: OidcStrategyOptions, verify: OidcVerifyFunction);
//   constructor(
//     options: OidcStrategyOptionsWithRequest,
//     verify: OidcVerifyFunctionWithRequest,
//   );
//   constructor(
//     options: OidcStrategyOptions | OidcStrategyOptionsWithRequest,
//     verify: OidcVerifyFunction | OidcVerifyFunctionWithRequest,
//   ) {
//     super();

//     if (!(options?.config instanceof oidc.Configuration)) {
//       throw new TypeError(
//         'OIDC Strategy requires a valid openid-client Configuration',
//       );
//     }

//     if (typeof verify !== 'function') {
//       throw new TypeError('OIDC Strategy requires a verify function');
//     }

//     const { host } = new URL(options.config.serverMetadata().issuer);

//     this.name = options.name ?? host;
//     this._sessionKey = options.sessionKey ?? host;
//     this._DPoP = options.DPoP;
//     this._config = options.config;
//     this._scope = options.scope;
//     this._useJAR = options.useJAR ?? false;
//     this._usePAR = options.usePAR ?? false;
//     this._verify = verify;

//     if (options.callbackURL) {
//       this._callbackURL = new URL(options.callbackURL);
//     }

//     this._passReqToCallback = options.passReqToCallback ?? false;
//     this._resource = options.resource;
//     this._authorizationDetails = options.authorizationDetails;
//   }

//   /**
//    * Return additional authorization request parameters.
//    * This mirrors the openid-client strategy's method signature.
//    */
//   authorizationRequestParams<TOptions extends OidcAuthenticateOptions>(
//     req: Request,
//     options: TOptions,
//   ): URLSearchParams | Record<string, string> | undefined {
//     const params = new URLSearchParams();

//     if (options?.scope) {
//       if (Array.isArray(options.scope) && options.scope.length) {
//         params.set('scope', options.scope.join(' '));
//       } else if (typeof options.scope === 'string' && options.scope.length) {
//         params.set('scope', options.scope);
//       }
//     }

//     if (options?.prompt) {
//       params.set('prompt', options.prompt);
//     }

//     if (options?.loginHint) {
//       params.set('login_hint', options.loginHint);
//     }

//     if (options?.idTokenHint) {
//       params.set('id_token_hint', options.idTokenHint);
//     }

//     if (options?.resource) {
//       this.setResourceParams(params, options.resource);
//     }

//     if (options?.authorizationDetails) {
//       this.setAuthorizationDetailsParams(params, options.authorizationDetails);
//     }

//     if (options?.callbackURL) {
//       params.set('redirect_uri', new URL(options.callbackURL).href);
//     }

//     return params;
//   }

//   /**
//    * Return additional token endpoint request parameters.
//    * This mirrors the openid-client strategy's method signature.
//    */
//   authorizationCodeGrantParameters<TOptions extends OidcAuthenticateOptions>(
//     req: Request,
//     options: TOptions,
//   ): URLSearchParams | Record<string, string> | undefined {
//     const params = new URLSearchParams();

//     if (options?.resource) {
//       this.setResourceParams(params, options.resource);
//     }

//     return params;
//   }

//   /**
//    * Return the current request URL.
//    * This mirrors the openid-client strategy's method signature.
//    */
//   currentUrl(req: Request): URL {
//     return new URL(
//       `${req.protocol}://${this.getHost(req)}${req.originalUrl ?? req.url}`,
//     );
//   }

//   /**
//    * Determine whether to initiate an authorization request.
//    * This mirrors the openid-client strategy's method signature.
//    */
//   shouldInitiateAuthRequest<TOptions extends OidcAuthenticateOptions>(
//     req: Request,
//     currentUrl: URL,
//     options: TOptions,
//   ): boolean {
//     return (
//       req.method === 'GET' &&
//       !currentUrl.searchParams.has('code') &&
//       !currentUrl.searchParams.has('error') &&
//       !currentUrl.searchParams.has('response')
//     );
//   }

//   /**
//    * Main authenticate method - this is called by Passport
//    */
//   authenticate(req: Request, options: OidcAuthenticateOptions = {}): void {
//     if (!(req as any).session) {
//       return this.error(
//         new Error('OIDC authentication requires session support'),
//       );
//     }

//     const currentUrl = this.currentUrl(req);

//     if (this.shouldInitiateAuthRequest(req, currentUrl, options)) {
//       this.authorizationRequest(req, options);
//     } else {
//       this.authorizationCodeGrant(req, currentUrl, options);
//     }
//   }

//   /**
//    * Private method to handle authorization request initiation
//    */
//   private async authorizationRequest<TOptions extends OidcAuthenticateOptions>(
//     req: Request,
//     options: TOptions,
//   ): Promise<void> {
//     try {
//       let redirectTo = oidc.buildAuthorizationUrl(
//         this._config,
//         new URLSearchParams(this.authorizationRequestParams(req, options)),
//       );

//       // Handle implicit flow with ID tokens
//       if (redirectTo.searchParams.get('response_type')?.includes('id_token')) {
//         redirectTo.searchParams.set('nonce', this.randomNonce());

//         if (!redirectTo.searchParams.has('response_mode')) {
//           redirectTo.searchParams.set('response_mode', 'form_post');
//         }
//       }

//       // PKCE implementation
//       const codeVerifier = this.randomPKCECodeVerifier();
//       const codeChallenge = await this.calculatePKCECodeChallenge(codeVerifier);
//       redirectTo.searchParams.set('code_challenge', codeChallenge);
//       redirectTo.searchParams.set('code_challenge_method', 'S256');

//       // State parameter for non-PKCE flows
//       if (
//         !this._config.serverMetadata().supportsPKCE() &&
//         !redirectTo.searchParams.has('nonce')
//       ) {
//         redirectTo.searchParams.set('state', this.randomState());
//       }

//       // Set callback URL
//       if (this._callbackURL && !redirectTo.searchParams.has('redirect_uri')) {
//         redirectTo.searchParams.set('redirect_uri', this._callbackURL.href);
//       }

//       // Set default scope
//       if (this._scope && !redirectTo.searchParams.has('scope')) {
//         redirectTo.searchParams.set('scope', this._scope);
//       }

//       // Set resource parameters
//       if (this._resource && !redirectTo.searchParams.has('resource')) {
//         this.setResourceParams(redirectTo.searchParams, this._resource);
//       }

//       // Set authorization details
//       if (
//         this._authorizationDetails &&
//         !redirectTo.searchParams.has('authorization_details')
//       ) {
//         this.setAuthorizationDetailsParams(
//           redirectTo.searchParams,
//           this._authorizationDetails,
//         );
//       }

//       // DPoP support
//       const DPoP = await this._DPoP?.(req);
//       if (DPoP && !redirectTo.searchParams.has('dpop_jkt')) {
//         redirectTo.searchParams.set(
//           'dpop_jkt',
//           await DPoP.calculateThumbprint(),
//         );
//       }

//       // Store state data in session
//       const stateData: StateData = { code_verifier: codeVerifier };

//       const nonce = redirectTo.searchParams.get('nonce');
//       if (nonce) stateData.nonce = nonce;

//       const state = redirectTo.searchParams.get('state');
//       if (state) stateData.state = state;

//       const maxAge = redirectTo.searchParams.get('max_age');
//       if (maxAge) stateData.max_age = parseInt(maxAge, 10);

//       (req as any).session[this._sessionKey] = stateData;

//       // Handle JAR (JWT Assertion Request)
//       if (this._useJAR && this._useJAR !== false) {
//         let key: oidc.CryptoKey | oidc.PrivateKey;
//         let modifyAssertion: oidc.ModifyAssertionFunction | undefined;

//         if (Array.isArray(this._useJAR)) {
//           [key, modifyAssertion] = this._useJAR;
//         } else {
//           key = this._useJAR;
//         }

//         redirectTo = await oidc.buildAuthorizationUrlWithJAR(
//           this._config,
//           redirectTo.searchParams,
//           key,
//           { [oidc.modifyAssertion]: modifyAssertion },
//         );
//       }

//       // Handle PAR (Pushed Authorization Request)
//       if (this._usePAR) {
//         redirectTo = await oidc.buildAuthorizationUrlWithPAR(
//           this._config,
//           redirectTo.searchParams,
//           { DPoP },
//         );
//       }

//       return this.redirect(redirectTo.href);
//     } catch (err) {
//       return this.error(err instanceof Error ? err : new Error(String(err)));
//     }
//   }

//   /**
//    * Private method to handle authorization code grant
//    */
//   private async authorizationCodeGrant<
//     TOptions extends OidcAuthenticateOptions,
//   >(req: Request, currentUrl: URL, options: TOptions): Promise<void> {
//     try {
//       const stateData: StateData = (req as any).session[this._sessionKey];

//       if (!stateData?.code_verifier) {
//         return this.fail({
//           message: 'Unable to verify authorization request state',
//         });
//       }

//       // Handle callback URL override
//       if (options.callbackURL || this._callbackURL) {
//         const _currentUrl = new URL(options.callbackURL || this._callbackURL!);
//         for (const [k, v] of currentUrl.searchParams.entries()) {
//           _currentUrl.searchParams.append(k, v);
//         }
//         currentUrl = _currentUrl;
//       }

//       // Handle POST requests (form_post response mode)
//       let input: URL | Request = currentUrl;
//       if (req.method === 'POST') {
//         const headers = new Headers();
//         if (req.headers) {
//           Object.entries(req.headers).forEach(([key, value]) => {
//             if (Array.isArray(value)) {
//               value.forEach((v) => headers.append(key, v));
//             } else if (value) {
//               headers.append(key, value);
//             }
//           });
//         }

//         input = new Request(currentUrl.href, {
//           method: 'POST',
//           headers,
//           body: req as any,
//           duplex: 'half' as any,
//         });
//       }

//       // Exchange code for tokens
//       const tokens = await oidc.authorizationCodeGrant(
//         this._config,
//         input,
//         {
//           pkceCodeVerifier: stateData.code_verifier,
//           expectedNonce: stateData.nonce,
//           expectedState: stateData.state,
//           maxAge: stateData.max_age,
//         },
//         this.authorizationCodeGrantParameters(req, options),
//         { DPoP: await this._DPoP?.(req) },
//       );

//       // Create type-safe verified callback
//       const verified: OidcVerifyCallback = (err, user, info) => {
//         if (err) return this.error(err);
//         if (!user)
//           return this.fail(info || { message: 'Authentication failed' });
//         return this.success(user);
//       };

//       // Call verify function
//       if (this._passReqToCallback) {
//         return (this._verify as OidcVerifyFunctionWithRequest)(
//           req,
//           tokens,
//           verified,
//         );
//       }

//       return (this._verify as OidcVerifyFunction)(tokens, verified);
//     } catch (err) {
//       if (
//         err instanceof oidc.AuthorizationResponseError &&
//         err.error === 'access_denied'
//       ) {
//         return this.fail({
//           message: err.error_description || err.error,
//           ...Object.fromEntries(err.cause.entries()),
//         });
//       }
//       return this.error(err instanceof Error ? err : new Error(String(err)));
//     }
//   }

//   // Helper methods
//   private getHost(req: Request): string {
//     try {
//       const trust = (req as any).app?.get('trust proxy fn');
//       let val = req.get('x-forwarded-host');

//       if (!val || !trust?.(req.socket?.remoteAddress, 0)) {
//         val = req.get('host');
//       } else if (val.indexOf(',') !== -1) {
//         val = val.substring(0, val.indexOf(',')).trimRight();
//       }

//       return val || req.headers.host || 'localhost';
//     } catch {
//       return req.headers.host || 'localhost';
//     }
//   }

//   private setResourceParams(
//     params: URLSearchParams,
//     resource: string | string[],
//   ): void {
//     if (Array.isArray(resource)) {
//       resource.forEach((value) => params.append('resource', value));
//     } else {
//       params.set('resource', resource);
//     }
//   }

//   private setAuthorizationDetailsParams(
//     params: URLSearchParams,
//     authorizationDetails:
//       | oidc.AuthorizationDetails
//       | oidc.AuthorizationDetails[],
//   ): void {
//     if (Array.isArray(authorizationDetails)) {
//       params.set('authorization_details', JSON.stringify(authorizationDetails));
//     } else {
//       params.set(
//         'authorization_details',
//         JSON.stringify([authorizationDetails]),
//       );
//     }
//   }

//   private randomNonce(): string {
//     return randomBytes(16).toString('base64url');
//   }

//   private randomState(): string {
//     return randomBytes(16).toString('base64url');
//   }

//   private randomPKCECodeVerifier(): string {
//     return randomBytes(32).toString('base64url');
//   }

//   private async calculatePKCECodeChallenge(
//     codeVerifier: string,
//   ): Promise<string> {
//     return createHash('sha256').update(codeVerifier).digest('base64url');
//   }
// }
