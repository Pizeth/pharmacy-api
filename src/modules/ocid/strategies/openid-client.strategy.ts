import { NormalizedProfile, OidcTokens } from '../interfaces/oidc.interface';

import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { IdentityProvider } from '@prisma/client';

// The official passport strategy and related functions/types
import * as oidc from 'openid-client';
import {
  Strategy as OidcPassportStrategy,
  StrategyOptions,
  VerifyFunction,
} from 'openid-client/passport';

// Types for the verify function callback
import type { AuthenticateCallback } from 'passport';
import type {
  TokenEndpointResponse,
  UserInfoResponse,
  TokenEndpointResponseHelpers,
} from 'openid-client';
import { AppError } from 'src/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common/enums';

@Injectable()
export class OidcStrategyFactory {
  private readonly logger = new Logger(OidcStrategyFactory.name);

  constructor(private readonly authService: AuthService) {}

  async createStrategy(
    provider: IdentityProvider,
  ): Promise<OidcPassportStrategy> {
    try {
      const config = await oidc.discovery(
        new URL(provider.issuer),
        provider.clientID,
        provider.clientSecret,
      );

      const scope = provider.scope
        ?.split(',')
        .map((s) => s.trim())
        .join(' ');

      const options: StrategyOptions = {
        config,
        name: provider.name,
        sessionKey: provider.name,
        callbackURL: provider.callbackURL,
        scope,
        passReqToCallback: false,
      };

      const verify: VerifyFunction = (
        tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
        done: AuthenticateCallback,
      ): Promise<void> => {
        try {
          const sub = tokens.claims()?.sub;
          if (!sub) {
            // concrete Error instance — no unknowns here
            return done(
              new AppError(
                'ID token "sub" claim is missing.',
                HttpStatus.UNAUTHORIZED,
              ),
            );
          }

          const userinfo = oidc
            .fetchUserInfo(config, tokens.access_token, sub)
            .then((userinfo) => {
              const normalizedProfile = this.normalizeProfile(
                provider,
                userinfo,
              );
              return normalizedProfile;
            });
          //   const normalizedProfile = this.normalizeProfile(provider, userinfo);

          const expiresAt = tokens.expires_in
            ? Date.now() + tokens.expires_in * 1000
            : undefined;

          const oidcTokens: OidcTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresAt,
          };

          //   const signedUser = await this.authService.oidcLogin(
          //     provider.name,
          //     normalizedProfile,
          //     oidcTokens,
          //   );

          //   if (!signedUser?.user) {
          //     return done(null, false, {
          //       message: 'User could not be verified or created.',
          //     });
          //   }

          return done(null, signedUser.user);
        } catch (err: unknown) {
          // narrow unknown -> Error before passing to done()
          const safeError: Error =
            err instanceof Error
              ? err
              : new Error(
                  String(err ?? 'Unknown error during OIDC verification'),
                );

          this.logger.error(
            `OIDC verification error for provider ${provider.name}`,
            safeError.stack ?? String(safeError),
          );
          return done(safeError);
        }
      };

      // Now the constructor call is safe: verify is a VerifyFunction and only ever
      // calls done(...) with a real Error instance when it fails.
      return new OidcPassportStrategy(options, verify);
    } catch (error) {
      this.logger.error(
        `Failed to create OIDC strategy for provider '${provider.name}'`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handles the token verification process.
   * Separated from the verify function for better organization while maintaining proper typing.
   */
  private handleTokenVerification(
    provider: IdentityProvider,
    config: oidc.Configuration,
    tokens: TokenEndpointResponse & TokenEndpointResponseHelpers,
    done: AuthenticateCallback,
  ): void {
    Promise.resolve()
      .then(() => {
        const sub = tokens.claims()?.sub;
        if (!sub) {
          // Throw an error to be handled by the final .catch block
          throw new AppError(
            'ID token "sub" claim is missing.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        return oidc.fetchUserInfo(config, tokens.access_token, sub);
      })
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
        if (!signedUser || !signedUser.user) {
          done(null, false, {
            message: 'User could not be verified or created.',
          });
        } else {
          done(null, signedUser.user);
        }
      })
      .catch((error: unknown) => {
        this.handleVerifyError(error, done);
      });
  }

  /**
   * A dedicated, type-safe error handler for the verify function's promise chain.
   * This isolates the handling of `unknown` error types to satisfy strict linters.
   */
  private handleVerifyError(error: unknown, done: AuthenticateCallback): void {
    this.logger.error(
      'An error occurred during OIDC user verification',
      error instanceof Error ? error.stack : error,
    );
    if (error instanceof Error) {
      done(error);
    } else {
      done(new Error('An unexpected error occurred during OIDC verification.'));
    }
  }

  private normalizeProfile(
    provider: IdentityProvider,
    userinfo: UserInfoResponse,
  ): NormalizedProfile {
    return {
      id: userinfo.sub,
      providerId: provider.id,
      provider: provider.name,
      displayName:
        userinfo.name || userinfo.nickname || userinfo.preferred_username,
      username: userinfo.preferred_username,
      name: userinfo.name,
      email: userinfo.email || '',
      emailVerified: userinfo.email_verified || false,
      photo: userinfo.picture,
      raw: userinfo,
    };
  }
}
