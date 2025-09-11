// import { Injectable, Logger } from '@nestjs/common';
// import { AuthService } from 'src/modules/auth/services/auth.service';
// import { OidcStrategy } from '../../auth/strategies/oidc.strategy';
// import { IdentityProvider } from '@prisma/client';
// import { OidcProviderService } from '../services/oidc-provider.service';

// @Injectable()
// export class OidcStrategyFactoryOld {
//   constructor(
//     private readonly providerService: OidcProviderService,
//     private readonly authService: AuthService,
//   ) {}

//   createStrategy(provider: IdentityProvider): OidcStrategy {
//     return new OidcStrategy(this.authService, this.providerService, provider);
//   }
// }

// CORRECTED: Import the entire module to access its functions, like 'discovery'.
// import * as oidc from 'openid-client';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
// import { AuthService } from 'src/modules/auth/services/auth.service';
import { IdentityProvider } from '@prisma/client';
import {
  NormalizedProfile,
  OidcTokens,
  OidcUser,
} from '../interfaces/oidc.interface';

// The official passport strategy and related functions/types
import * as oidc from 'openid-client';
import {
  Strategy as OidcStrategy,
  StrategyOptions,
  VerifyFunction,
} from 'openid-client/passport';

// Types for the verify function callback
import type {
  Configuration,
  TokenEndpointResponse,
  TokenEndpointResponseHelpers,
  UserInfoResponse,
} from 'openid-client';
import { AppError } from 'src/exceptions/app.exception';
import { AuthenticateCallback } from '../types/oidc';

// declare module 'express-session' {
//   interface SessionData {
//     oidc?: {
//       [providerName: string]: {
//         code_verifier?: string;
//         state?: string;
//         nonce?: string;
//       };
//     };
//   }
// }

@Injectable()
export class OidcStrategyFactory {
  private readonly context = OidcStrategyFactory.name;
  private readonly logger = new Logger(this.context);

  // constructor(private readonly authService: AuthService) {}

  async createStrategy(provider: IdentityProvider): Promise<OidcStrategy> {
    try {
      // 1. Discover the provider's configuration and create the config object.
      const config = await oidc.discovery(
        new URL(provider.issuer),
        provider.clientID,
        provider.clientSecret,
        // oidc.ClientSecretPost(provider.clientSecret), // Or another auth method if needed
      );

      this.logger.log(
        `Successfully discovered and configured provider: ${provider.name}`,
      );

      // 2. Define the options for the official Passport strategy.
      const options: StrategyOptions = {
        config,
        name: provider.name,
        sessionKey: provider.name, // Use provider name for unique session key
        callbackURL: provider.callbackURL,
        scope:
          provider.scope
            ?.split(',')
            .map((s) => s.trim())
            .join(' ') || 'openid profile email',
        passReqToCallback: false,
      };

      // 3. Define the verify function. This is where our application logic lives.
      // It's called by the strategy after it successfully completes the OIDC flow.
      const verify: VerifyFunction = async (
        tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
        done: AuthenticateCallback,
      ) => {
        try {
          const sub = tokens.claims()?.sub;
          if (!sub) {
            return done(
              new Error('ID token "sub" claim is missing.'),
              // new AppError(
              //   'ID token "sub" claim is missing.',
              //   HttpStatus.UNAUTHORIZED,
              //   this.context,
              //   {
              //     claim: 'Available claims: ' + JSON.stringify(tokens.claims()),
              //   },
              // ),
            );
          }

          const userinfo = await oidc.fetchUserInfo(
            config,
            tokens.access_token,
            sub,
          );

          const normalizedProfile = this.normalizeProfile(provider, userinfo);

          //  Correctly calculate the expiration timestamp from `expires_in`.
          const expiresAt = tokens.expires_in
            ? Date.now() + tokens.expires_in * 1000
            : undefined;

          const oidcTokens: OidcTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresAt,
          };

          const result: OidcUser = {
            profile: normalizedProfile,
            claim: oidcTokens,
          };

          // const signedUser = await this.authService.oidcLogin(
          //   provider.name,
          //   normalizedProfile,
          //   oidcTokens,
          // );

          // if (!signedUser || !signedUser.user) {
          //   return done(null, false); // Authentication failed
          // }

          return done(null, result); // Authentication successful
        } catch (error: unknown) {
          this.logger.error(
            `Error during OIDC user verification for ${provider.name}`,
            error,
          );

          // Unsafe assignment of an error typed value.
          // const errorToReport =
          //   error instanceof Error
          //     ? error
          //     : new Error(
          //         'An unexpected error occurred during OIDC verification.',
          //       );
          // : new AppError(
          //     'An unexpected error occurred during OIDC verification.',
          //     HttpStatus.UNAUTHORIZED,
          //     this.context,
          //     { originalError: error },
          //   );
          return done(
            new Error('An unexpected error occurred during OIDC verification.'),
            false,
          );
        }
      };

      // const verifyNew = this.createVerifyFunction(config, provider);

      // 4. Instantiate and return the official strategy with the verify function
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return new OidcStrategy(options, verify);
    } catch (error) {
      this.logger.error(
        `Failed to create OIDC strategy for provider '${provider.name}'`,
        error,
      );
      throw error;
    }
  }

  private createVerifyFunction(
    config: Configuration,
    provider: IdentityProvider,
  ): VerifyFunction {
    return async (
      tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
      // done: (error: any, user?: any) => void,
      done: AuthenticateCallback,
    ) => {
      try {
        this.logger.log(`Verifying user from ${provider.name} provider`);

        const sub = tokens.claims()?.sub;
        if (!sub) {
          done(
            new Error('ID token "sub" claim is missing.'),
            // new AppError(
            //   'ID token "sub" claim is missing.',
            //   HttpStatus.UNAUTHORIZED,
            //   this.context,
            //   {
            //     claim: 'Available claims: ' + JSON.stringify(tokens.claims()),
            //   },
            // ),
          );
          return;
        }

        const userinfo = await oidc.fetchUserInfo(
          config,
          tokens.access_token,
          sub,
        );

        // Create normalized profile
        const normalizedProfile = this.normalizeProfile(provider, userinfo);

        //  Correctly calculate the expiration timestamp from `expires_in`.
        const expiresAt = tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined;

        const oidcTokens: OidcTokens = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresAt,
        };

        const result: OidcUser = {
          profile: normalizedProfile,
          claim: oidcTokens,
        };

        // // Login or create user
        // const user = await authService.oidcLogin(
        //   providerName,
        //   normalizedProfile,
        //   {
        //     accessToken: tokens.access_token,
        //     refreshToken: tokens.refresh_token,
        //     idToken: tokens.id_token,
        //     expiresIn: tokens.expires_in,
        //   },
        // );

        // if (!user) {
        //   return done(null, false);
        // }

        return done(null, result);
      } catch (error) {
        this.logger.error('Verification error:', error);
        // Unsafe assignment of an error typed value.
        const errorToReport =
          error instanceof Error
            ? error
            : new AppError(
                'An unexpected error occurred during OIDC verification.',
                HttpStatus.UNAUTHORIZED,
                this.context,
                { originalError: error },
              );
        return done(new Error(errorToReport.message), false);
      }
    };
  }

  private normalizeProfile(
    provider: IdentityProvider,
    userinfo: UserInfoResponse,
  ): NormalizedProfile {
    // Construct the full name if the name object exists, otherwise use displayName
    const displayName = userinfo.name
      ? `${userinfo.given_name || ''} ${userinfo.middle_name || ''} ${userinfo.family_name || ''}`.trim()
      : userinfo.preferred_username || userinfo.nickname;

    return {
      id: userinfo.sub,
      providerId: provider.id,
      provider: provider.name,
      username: userinfo.preferred_username,
      name: userinfo.name,
      email: userinfo.email || '',
      emailVerified: userinfo.email_verified || false,
      photo: userinfo.picture,
      raw: userinfo,
    };
  }

  private async normalizeProfile(
    profile: UserInfoResponse,
    issuer: string,
  ): Promise<NormalizedProfile> {
    // Construct the full name if the name object exists, otherwise use displayName
    const fullName = profile.name
      ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim()
      : profile.displayName;

    // Attempt to determine the provider name from the issuer URL
    const provider =
      (await this.extractProviderName(issuer)) || profile.provider || this.name;

    return {
      id: profile.id,
      providerId: this.provider.id,
      // provider: this.provider.name,
      provider: this.name,
      displayName: profile.displayName,
      username: profile.username,
      // Use the more robust full name we constructed
      name: fullName,

      // Safely access the first email value, which could be undefined
      email: profile.emails?.[0]?.value || '',

      emailVerified: true, // This is an assumption; might need adjustment per provider

      // Safely access the first photo value, which could be undefined
      photo: profile.photos?.[0]?.value,

      // We remove the `raw` property as it's not part of the standard Profile interface
      raw: profile,
    };
  }
}
