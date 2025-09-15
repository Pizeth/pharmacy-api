// // oidc-strategy.factory.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { AuthService } from 'src/modules/auth/services/auth.service';
// import { IdentityProvider } from '@prisma/client';
// import { AppError } from 'src/exceptions/app.exception';
// import { HttpStatus } from '@nestjs/common/enums';

// // OpenID Client v6.x imports
// import * as oidc from 'openid-client';
// import {
//   Strategy as OidcPassportStrategy,
//   StrategyOptions,
//   VerifyFunction,
// } from 'openid-client/passport';

// // Passport types
// import type { AuthenticateCallback } from 'passport';
// import type {
//   TokenEndpointResponse,
//   UserInfoResponse,
//   TokenEndpointResponseHelpers,
// } from 'openid-client';

// import { NormalizedProfile, OidcTokens } from '../interfaces/oidc.interface';

// @Injectable()
// export class OidcStrategyFactory {
//   private readonly logger = new Logger(OidcStrategyFactory.name);

//   constructor(private readonly authService: AuthService) {}

//   async createStrategy(
//     provider: IdentityProvider,
//   ): Promise<OidcPassportStrategy> {
//     try {
//       // Discover the OIDC configuration
//       const config = await oidc.discovery(
//         new URL(provider.issuer),
//         provider.clientID,
//         provider.clientSecret,
//       );

//       // Parse scope
//       const scope =
//         provider.scope
//           ?.split(',')
//           .map((s) => s.trim())
//           .join(' ') || 'openid';

//       // Strategy options
//       const options: StrategyOptions = {
//         config,
//         name: provider.name,
//         sessionKey: provider.name,
//         callbackURL: provider.callbackURL,
//         scope,
//         passReqToCallback: false,
//       };

//       // Create the verify function with the safe callback wrapper
//       const verify: VerifyFunction = (
//         tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
//         done: AuthenticateCallback,
//       ): void => {
//         const safeCallback = this.createSafeCallback(done);
//         this.handleTokenVerificationSafe(
//           provider,
//           config,
//           tokens,
//           safeCallback,
//         );
//       };

//       return new OidcPassportStrategy(options, verify);
//     } catch (error) {
//       this.logger.error(
//         `Failed to create OIDC strategy for provider '${provider.name}'`,
//         error,
//       );
//       throw error;
//     }
//   }

//   /**
//    * Safe token verification handler using the wrapper
//    */
//   private handleTokenVerificationSafe(
//     provider: IdentityProvider,
//     config: oidc.Configuration,
//     tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
//     callback: ReturnType<typeof this.createSafeCallback>,
//   ): void {
//     Promise.resolve()
//       .then(async () => {
//         const claims = tokens.claims();
//         const sub = claims?.sub;

//         if (!sub) {
//           throw new AppError(
//             'ID token "sub" claim is missing.',
//             HttpStatus.UNAUTHORIZED,
//           );
//         }

//         const userinfo = await oidc.fetchUserInfo(
//           config,
//           tokens.access_token,
//           sub,
//         );

//         return { userinfo };
//       })
//       .then(async ({ userinfo }) => {
//         const normalizedProfile = this.normalizeProfile(provider, userinfo);

//         const expiresAt = tokens.expires_in
//           ? Date.now() + tokens.expires_in * 1000
//           : undefined;

//         const oidcTokens: OidcTokens = {
//           accessToken: tokens.access_token,
//           refreshToken: tokens.refresh_token,
//           idToken: tokens.id_token,
//           expiresAt,
//         };

//         const signedUser = await this.authService.oidcLogin(
//           provider.name,
//           normalizedProfile,
//           oidcTokens,
//         );

//         if (!signedUser?.user) {
//           callback.fail({
//             message: 'User could not be verified or created.',
//           });
//           return;
//         }

//         callback.success(signedUser.user);
//       })
//       .catch((error: unknown) => {
//         this.logger.error(
//           'An error occurred during OIDC user verification',
//           error instanceof Error ? error.stack : String(error),
//         );

//         let errorInstance: Error;

//         if (error instanceof Error) {
//           errorInstance = error;
//         } else if (error instanceof AppError) {
//           errorInstance = error;
//         } else {
//           errorInstance = new Error(
//             'An unexpected error occurred during OIDC verification.',
//           );
//         }

//         callback.error(errorInstance);
//       });
//   }

//   private createSafeCallback(callback: AuthenticateCallback) {
//     return {
//       success: (user: Express.User) => {
//         callback(null, user);
//       },

//       fail: (info?: object | string) => {
//         callback(null, false, info);
//       },

//       error: (error: Error) => {
//         callback(error);
//       },
//     };
//   }

//   /**
//    * Normalize user profile from different OIDC providers
//    */
//   private normalizeProfile(
//     provider: IdentityProvider,
//     userinfo: UserInfoResponse,
//   ): NormalizedProfile {
//     return {
//       id: userinfo.sub,
//       providerId: provider.id,
//       provider: provider.name,
//       displayName:
//         userinfo.name ||
//         userinfo.nickname ||
//         userinfo.preferred_username ||
//         userinfo.email ||
//         'Unknown User',
//       username: userinfo.preferred_username,
//       name: userinfo.name,
//       email: userinfo.email || '',
//       emailVerified: userinfo.email_verified || false,
//       photo: userinfo.picture,
//       raw: userinfo,
//     };
//   }
// }

// oidc-strategy.factory.ts
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { IdentityProvider } from '@prisma/client';
import { HttpStatus } from '@nestjs/common/enums';

// OpenID Client v6.x imports
import * as oidc from 'openid-client';
import {
  Strategy as OidcPassportStrategy,
  StrategyOptions,
  VerifyFunction,
} from 'openid-client/passport';

// Passport types
import type { AuthenticateCallback } from 'passport';
import type {
  TokenEndpointResponse,
  UserInfoResponse,
  TokenEndpointResponseHelpers,
} from 'openid-client';

import { NormalizedProfile, OidcTokens } from '../interfaces/oidc.interface';

@Injectable()
export class OidcStrategyFactory {
  private readonly logger = new Logger(OidcStrategyFactory.name);

  constructor(private readonly authService: AuthService) {}

  async createStrategy(
    provider: IdentityProvider,
  ): Promise<OidcPassportStrategy> {
    try {
      // Discover the OIDC configuration
      const config = await oidc.discovery(
        new URL(provider.issuer),
        provider.clientID,
        provider.clientSecret,
      );

      // Parse scope
      const scope =
        provider.scope
          ?.split(',')
          .map((s) => s.trim())
          .join(' ') || 'openid';

      // Strategy options
      const options: StrategyOptions = {
        config,
        name: provider.name,
        sessionKey: provider.name,
        callbackURL: provider.callbackURL,
        scope,
        passReqToCallback: false,
      };

      // Create the verify function with proper error handling
      const verify: VerifyFunction = (
        tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
        done: AuthenticateCallback,
      ): void => {
        this.handleTokenVerification(provider, config, tokens, done);
      };

      return new OidcPassportStrategy(options, verify);
    } catch (error) {
      this.logger.error(
        `Failed to create OIDC strategy for provider '${provider.name}'`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Token verification handler with proper error handling
   */
  private handleTokenVerification(
    provider: IdentityProvider,
    config: oidc.Configuration,
    tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
    done: AuthenticateCallback,
  ): void {
    try {
      const claims = tokens.claims();
      const sub = claims?.sub;

      if (!sub) {
        // Convert to standard Error object
        done(
          new Error('ID token "sub" claim is missing.'),
          null,
          { message: 'ID token "sub" claim is missing.' },
          HttpStatus.UNAUTHORIZED,
        );
        return;
      }

      oidc
        .fetchUserInfo(config, tokens.access_token, sub)
        .then((userinfo) => {
          const normalizedProfile = this.normalizeProfile(provider, userinfo);

          const expiresAt = tokens.expires_in
            ? Date.now() + tokens.expires_in * 1000
            : undefined;

          const oidcTokens: OidcTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresAt,
          };

          return this.authService.oidcLogin(
            provider.name,
            normalizedProfile,
            oidcTokens,
          );
        })
        .then((signedUser) => {
          if (!signedUser?.user) {
            // Use Passport's expected callback signature
            done(null, false, {
              message: 'User could not be verified or created.',
            });
            return;
          }
          done(null, signedUser.user);
          return;
        })
        .catch((error: unknown) => {
          this.logger.error(
            'An error occurred during OIDC user verification',
            error instanceof Error ? error.stack : undefined,
          );

          // Convert any error to a proper Error object
          const safeError = this.ensureError(error);
          done(safeError);
          return;
        });
    } catch (error) {
      this.logger.error(
        'An error occurred during OIDC user verification',
        error instanceof Error ? error.stack : undefined,
      );

      // Convert any error to a proper Error object
      const safeError = this.ensureError(error);
      done(safeError);
      return;
    }
  }

  /**
   * Ensures any value is converted to a proper Error object
   * This addresses the "Unsafe construction of error type" issue
   */
  private ensureError(value: unknown): Error {
    if (value instanceof Error) {
      return value;
    }

    let message = 'Unknown error';
    if (typeof value === 'string') {
      message = value;
    } else if (value && typeof value === 'object' && 'message' in value) {
      message = String((value as any).message);
    }

    return new Error(message);
  }

  /**
   * Normalize user profile from different OIDC providers
   */
  private normalizeProfile(
    provider: IdentityProvider,
    userinfo: UserInfoResponse,
  ): NormalizedProfile {
    return {
      id: userinfo.sub,
      providerId: provider.id,
      provider: provider.name,
      displayName:
        userinfo.name ||
        userinfo.nickname ||
        userinfo.preferred_username ||
        userinfo.email ||
        'Unknown User',
      username: userinfo.preferred_username,
      name: userinfo.name,
      email: userinfo.email || '',
      emailVerified: userinfo.email_verified || false,
      photo: userinfo.picture,
      raw: userinfo,
    };
  }
}
