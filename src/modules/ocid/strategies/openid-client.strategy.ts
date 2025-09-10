import { Strategy } from 'passport';
import * as client from 'openid-client';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import { OpenIDStrategyOptions } from '../interfaces/oidc.interface';
import { VerifyFunction } from '../types/token';

export class OpenIDClientStrategy extends Strategy {
  name = 'openid-client';
  //   private client: client;
  private readonly context = OpenIDClientStrategy.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly options: OpenIDStrategyOptions,
    private readonly verify: VerifyFunction,
    private readonly strategyName?: string,
  ) {
    super();
    if (strategyName) {
      this.name = strategyName;
    }
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const issuer = await client.discovery(
        this.options.issuer,
        this.options.clientID,
        this.options.clientSecret,
      );

      const authorizationCodeGrantRequest = new client.authorizationCodeGrant({
        grant_type: 'authorization_code',
        redirect_uri: this.options.callbackURL,
        scope: this.options.scope,
        response_mode: this.options.responseMode,
      });

      this.client = new issuer.Client({
        client_id: this.options.clientID,
        client_secret: this.options.clientSecret,
        redirect_uris: [this.options.callbackURL],
        response_types: [this.options.responseType || 'code'],
      });

      this.logger.log(
        `OpenID Client initialized for issuer: ${this.options.issuerURL}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize OpenID Client:', error);
      throw error;
    }
  }

  authenticate(req: Request, options?: any): void {
    if (!this.client) {
      this.error(new Error('OpenID Client not initialized'));
      return;
    }

    // Handle callback
    if (req.query?.code || req.query?.error) {
      this.handleCallback(req);
      return;
    }

    // Initiate authorization
    this.initiateAuth(req, options);
  }

  private initiateAuth(req: Request, options?: any): void {
    try {
      const state = generators.state();
      const nonce = generators.nonce();

      // Store state and nonce in session or cookie
      if (req.session) {
        (req.session as any).oidc = { state, nonce };
      }

      const authUrl = this.client!.authorizationUrl({
        scope: this.options.scope || 'openid profile email',
        response_mode: this.options.responseMode,
        prompt: this.options.prompt,
        state,
        nonce,
        ...options,
      });

      this.redirect(authUrl);
    } catch (error) {
      this.error(error);
    }
  }

  private async handleCallback(req: Request): Promise<void> {
    try {
      const params = this.client!.callbackParams(req);

      // Get stored state and nonce
      const sessionData = (req.session as any)?.oidc || {};
      const { state, nonce } = sessionData;

      // Validate state
      if (params.state !== state) {
        throw new Error('State mismatch');
      }

      // Exchange code for tokens
      const tokenSet = await this.client!.callback(
        this.options.callbackURL,
        params,
        { state, nonce },
      );

      // Get user profile
      const profile = await this.getUserProfile(tokenSet);

      // Extract tokens
      const tokens: OpenIDTokens = {
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        id_token: tokenSet.id_token,
        token_type: tokenSet.token_type,
        expires_at: tokenSet.expires_at,
        scope: tokenSet.scope,
      };

      // Call verify function
      await this.verify(profile, tokens, (error, user) => {
        if (error) {
          this.error(error);
        } else if (!user) {
          this.fail();
        } else {
          this.success(user);
        }
      });
    } catch (error) {
      this.logger.error('Callback error:', error);
      this.error(error);
    }
  }

  private async getUserProfile(tokenSet: TokenSet): Promise<OpenIDProfile> {
    try {
      // Try to get profile from userinfo endpoint
      if (
        this.client!.issuer.metadata.userinfo_endpoint &&
        tokenSet.access_token
      ) {
        const userinfo = await this.client!.userinfo(tokenSet);
        return userinfo as OpenIDProfile;
      }

      // Fallback to ID token claims
      if (tokenSet.id_token) {
        return tokenSet.claims() as OpenIDProfile;
      }

      throw new Error('No profile information available');
    } catch (error) {
      this.logger.error('Failed to get user profile:', error);
      throw error;
    }
  }
}

/**
 * OpenID Connect Strategy for Passport
 *
 * This strategy uses openid-client under the hood for proper OpenID Connect implementation
 * while maintaining Passport.js compatibility.
 */
export class OpenIDClientStrategy extends Strategy {
  private readonly logger = new Logger(OpenIDClientStrategy.name);
  private client: any;
  private issuer: any;
  private readonly options: OpenIDConnectStrategyOptions;
  private readonly verify: VerifyFunction;
  private readonly providerName: string;

  constructor(
    providerName: string,
    options: OpenIDConnectStrategyOptions,
    verify: VerifyFunction,
  ) {
    super();
    this.name = providerName;
    this.providerName = providerName;
    this.options = options;
    this.verify = verify;
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Configure HTTP client to handle potential network issues
      custom.setHttpOptionsDefaults({
        timeout: 10000,
      });

      // Discover issuer configuration
      this.issuer = await Issuer.discover(this.options.issuer);
      this.logger.log(
        `Discovered OpenID Connect issuer: ${this.issuer.issuer}`,
      );

      // Create client
      this.client = new this.issuer.Client({
        client_id: this.options.clientID,
        client_secret: this.options.clientSecret,
        redirect_uris: [this.options.callbackURL],
        response_types: ['code'],
      });

      this.logger.log(
        `Initialized OpenID Connect client for ${this.providerName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize OpenID Connect client for ${this.providerName}:`,
        error,
      );
      throw new OpenIDConnectError(
        'Failed to initialize OpenID Connect client',
        {
          issuer: this.options.issuer,
          error: error.message,
        },
      );
    }
  }

  async authenticate(req: Request, options?: any) {
    try {
      // Handle callback (after redirect from provider)
      if (req.query && req.query.code) {
        await this.handleCallback(req);
      }
      // Initial authentication request
      else {
        await this.handleAuthorization(req);
      }
    } catch (err) {
      this.logger.error(`OpenID Connect authentication failed:`, err);
      this.error(
        new OpenIDConnectError('OpenID Connect authentication failed', {
          provider: this.providerName,
          error: err.message,
        }),
      );
    }
  }

  private async handleAuthorization(req: Request) {
    // Generate state and nonce for security
    const state = this.options.state !== false ? uuidv4() : undefined;
    const nonce = this.options.nonce !== false ? uuidv4() : undefined;

    // Store state and nonce in session for verification later
    const strategyState: StrategyState = {
      state,
      nonce,
      providerName: this.providerName,
    };

    // Store in session (NestJS doesn't have session by default, so we'll use req.session)
    if (!req.session) {
      req.session = {};
    }
    req.session.openid = req.session.openid || {};
    req.session.openid[this.providerName] = strategyState;

    // Build authorization URL
    const authorizationUrl = this.client.authorizationUrl({
      scope: this.options.scope?.join(' ') || 'openid profile email',
      state,
      nonce,
      response_mode: this.options.responseMode,
    });

    this.logger.log(
      `Redirecting to OpenID Connect provider: ${authorizationUrl}`,
    );
    this.redirect(authorizationUrl);
  }

  private async handleCallback(req: Request) {
    // Retrieve state from session
    const sessionState = req.session?.openid?.[this.providerName];

    // Verify state
    if (this.options.state !== false) {
      if (!sessionState?.state) {
        throw new OpenIDConnectError('Missing state in session');
      }
      if (req.query.state !== sessionState.state) {
        throw new OpenIDConnectError('State mismatch', {
          expected: sessionState.state,
          received: req.query.state,
        });
      }
    }

    try {
      // Process the callback
      const params = this.client.callbackParams(req);
      const tokenset = await this.client.callback(
        this.options.callbackURL,
        params,
        {
          state: sessionState?.state,
          nonce: sessionState?.nonce,
        },
      );

      // Verify ID token signature and claims
      await this.client.userinfo(tokenset);

      // Create profile from ID token claims
      const claims = tokenset.claims();
      const profile: OpenIDConnectProfile = {
        id: claims.sub,
        displayName: claims.name,
        username: claims.preferred_username,
        name: {
          givenName: claims.given_name,
          familyName: claims.family_name,
        },
        emails: claims.email
          ? [
              {
                value: claims.email,
                verified: claims.email_verified,
              },
            ]
          : [],
        photos: claims.picture ? [{ value: claims.picture }] : [],
        provider: this.providerName,
        _json: claims,
        _raw: JSON.stringify(claims),
        // Include token information
        idToken: tokenset.id_token,
        accessToken: tokenset.access_token,
        refreshToken: tokenset.refresh_token,
        expiresIn: tokenset.expires_in,
        idTokenClaims: claims,
      };

      // Call the verify function
      this.verify(
        req,
        profile,
        tokenset.id_token,
        tokenset.access_token,
        tokenset.refresh_token,
        tokenset,
        (err, user, info) => {
          if (err) {
            return this.error(err);
          }
          if (!user) {
            return this.fail(info);
          }
          this.success(user, info);
        },
      );
    } catch (err) {
      this.logger.error(`OpenID Connect callback handling failed:`, err);
      throw new OpenIDConnectError(
        'Failed to process OpenID Connect callback',
        {
          provider: this.providerName,
          error: err.message,
        },
      );
    }
  }
}

// dynamic-oidc.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { OidcProviderService } from './oidc-provider.service';
import * as oauth from 'openid-client';

@Injectable()
export class DynamicOidcStrategy extends PassportStrategy(
  Strategy,
  'dynamic-oidc',
) {
  private configCache = new Map<string, oauth.Configuration>();

  constructor(private oidcProviderService: OidcProviderService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const provider = req.params.provider;
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!provider || !code) {
      throw new UnauthorizedException('Missing provider or authorization code');
    }

    try {
      const oidcProvider = await this.oidcProviderService.findByName(provider);
      const config = await this.getConfiguration(oidcProvider);

      // Verify state parameter
      const storedState = req.session?.oidcState;
      const storedCodeVerifier = req.session?.oidcCodeVerifier;

      if (!storedState || storedState !== state) {
        throw new UnauthorizedException('Invalid state parameter');
      }

      const redirectUri = this.getRedirectUri(req, provider);

      // Exchange authorization code for tokens
      const authorizationCodeGrantRequest: oauth.AuthorizationCodeGrantRequest =
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: storedCodeVerifier,
        };

      const authorizationCodeGrantResponse = await oauth.authorizationCodeGrant(
        config,
        authorizationCodeGrantRequest,
      );

      const result = await oauth.processAuthorizationCodeResponse(
        config,
        authorizationCodeGrantResponse,
      );

      if (oauth.isOAuth2Error(result)) {
        throw new UnauthorizedException(
          `OAuth2 Error: ${result.error_description || result.error}`,
        );
      }

      // Get userinfo if we have an access token
      let userinfo = null;
      if (result.access_token) {
        const userinfoRequest: oauth.UserInfoRequest = {
          access_token: result.access_token,
        };

        const userinfoResponse = await oauth.userinfo(config, userinfoRequest);
        userinfo = await oauth.processUserInfoResponse(
          config,
          userinfoResponse,
        );
      }

      // Clean up session
      delete req.session?.oidcState;
      delete req.session?.oidcCodeVerifier;

      return {
        provider,
        tokenSet: result,
        userinfo,
        oidcProvider,
      };
    } catch (error) {
      console.error('OIDC authentication error:', error);
      throw new UnauthorizedException(
        `OIDC authentication failed: ${error.message}`,
      );
    }
  }

  private async getConfiguration(
    oidcProvider: any,
  ): Promise<oauth.Configuration> {
    const cacheKey = `${oidcProvider.name}-${oidcProvider.issuer}`;

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    try {
      const issuerUrl = new URL(oidcProvider.issuer);
      const discoveryResponse = await oauth.discovery(
        issuerUrl,
        oidcProvider.clientId,
      );
      const issuer = await oauth.processDiscoveryResponse(
        issuerUrl,
        discoveryResponse,
      );

      if (oauth.isOAuth2Error(issuer)) {
        throw new Error(
          `Discovery failed: ${issuer.error_description || issuer.error}`,
        );
      }

      const config: oauth.Configuration = {
        issuer: issuer.issuer,
        authorization_endpoint: issuer.authorization_endpoint!,
        token_endpoint: issuer.token_endpoint!,
        userinfo_endpoint: issuer.userinfo_endpoint,
        jwks_uri: issuer.jwks_uri,
        client_id: oidcProvider.clientId,
        client_secret: oidcProvider.clientSecret,
        ...oidcProvider.additionalConfig,
      };

      this.configCache.set(cacheKey, config);
      return config;
    } catch (error) {
      throw new Error(`Failed to configure OIDC client: ${error.message}`);
    }
  }

  private getRedirectUri(req: Request, provider: string): string {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/${provider}/callback`;
  }
}
