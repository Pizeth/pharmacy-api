// import { AuthService } from 'src/modules/auth/services/auth.service';
// import { OIDCProviderConfig } from '../interfaces/oidc.interface';

import { OIDCProviderConfig } from '../interfaces/oidc.interface';

// function createOIDCStrategy(config: OIDCProviderConfig) {
//   const { Strategy } = require('passport-openidconnect');
//   const { PassportStrategy } = require('@nestjs/passport');

//   class DynamicOIDCStrategy extends PassportStrategy(
//     Strategy,
//     `oidc-${config.name}`,
//   ) {
//     constructor(private authService: AuthService) {
//       super({
//         issuer: config.issuer,
//         authorizationURL: config.authorizationURL,
//         tokenURL: config.tokenURL,
//         userInfoURL: config.userInfoURL,
//         clientID: config.clientID,
//         clientSecret: config.clientSecret,
//         callbackURL: config.callbackURL,
//         scope: config.scope || ['openid', 'email', 'profile'],
//       });
//     }

//     async validate(issuer: string, profile: any, done: any) {
//       try {
//         const oidcProfile = {
//           id: profile.id,
//           email: profile.emails?.[0]?.value || profile.email,
//           firstName: profile.name?.givenName || profile.given_name,
//           lastName: profile.name?.familyName || profile.family_name,
//           name: profile.displayName || profile.name,
//           picture: profile.photos?.[0]?.value || profile.picture,
//           provider: config.name,
//           raw: profile,
//         };

//         const result = await this.authService.oidcLogin(oidcProfile);
//         done(null, result);
//       } catch (error) {
//         done(error, null);
//       }
//     }
//   }

//   return DynamicOIDCStrategy;
// }

import { Strategy, Profile, VerifyCallback } from 'passport-openidconnect';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
// import { OidcConfigService } from '../services/oidc-config.service';
import { NormalizedProfile } from '../interfaces/oidc.interface';
import { Request } from 'express';

// @Injectable()
// export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
//   constructor(
//     private authService: AuthService,
//     private configService: OidcConfigService,
//   ) {
//     super(
//       {
//         passReqToCallback: true,
//         sessionKey: 'oauth2',
//       },
//       (req: Request, issuer: string, profile: any, done: Function) => {
//         this.validate(req, issuer, profile, done);
//       },
//     );
//   }

//   authenticate(req: Request, options: any) {
//     const provider = req.params.provider;
//     const config = this.configService.getConfig(provider);

//     super.authenticate(req, {
//       ...options,
//       ...config,
//       clientID: config.clientID,
//       clientSecret: config.clientSecret,
//       callbackURL: config.callbackURL,
//       scope: config.scope,
//       authorizationURL: config.authorizationURL,
//       tokenURL: config.tokenURL,
//       userInfoURL: config.userInfoURL,
//     });
//   }

//   async validate(
//     req: Request,
//     issuer: string,
//     profile: any,
//     done: Function,
//   ): Promise<any> {
//     const provider = req.params.provider;
//     const normalizedProfile = this.normalizeProfile(provider, profile);
//     const user = await this.authService.findOrCreateOidcUser(normalizedProfile);
//     done(null, user);
//   }

//   private normalizeProfile(provider: string, profile: any): NormalizedProfile {
//     switch (provider) {
//       case 'google':
//         return {
//           provider,
//           providerId: profile.id,
//           email: profile.emails[0].value,
//           emailVerified: profile.emails[0].verified,
//           name: profile.displayName,
//           picture: profile.picture,
//         };
//       case 'facebook':
//         return {
//           provider,
//           providerId: profile.id,
//           email: profile.emails?.[0].value || `${profile.id}@facebook.com`,
//           emailVerified: false,
//           name: profile.name?.givenName,
//           picture: profile.photos?.[0].value,
//         };
//       case 'microsoft':
//         return {
//           provider,
//           providerId: profile.id,
//           email: profile.emails[0].value,
//           emailVerified: true,
//           name: profile.displayName,
//           picture: null,
//         };
//       case 'apple':
//         return {
//           provider,
//           providerId: profile.sub,
//           email: profile.email,
//           emailVerified: true,
//           name: profile.name
//             ? `${profile.name.firstName} ${profile.name.lastName}`
//             : '',
//         };
//       default:
//         return {
//           provider,
//           providerId: profile.id,
//           email: profile.email || `${profile.id}@${provider}.com`,
//           emailVerified: profile.email_verified || false,
//           name: profile.displayName || profile.name,
//         };
//     }
//   }
// }

// This is a "factory class". It will be instantiated dynamically.
// We are not using the default @Injectable() decorator.
export class OidcStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly config: OIDCProviderConfig,
  ) {
    super(
      // Strategy options
      {
        issuer: config.issuer,
        authorizationURL: config.authorizationURL,
        tokenURL: config.tokenURL,
        userInfoURL: config.userInfoURL,
        clientID: config.clientID,
        clientSecret: config.clientSecret,
        callbackURL: config.callbackURL,
        scope: config.scope,
        // passReqToCallback: false, // Set to false, we don't need the req object in validate
      },
    );
    // Dynamically set the strategy name
    this.name = config.name;
  }

  // The validate function that passport-openidconnect will call
  async validate(
    issuer: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const normalizedProfile = this.normalizeProfile(profile);
      const user =
        await this.authService.findOrCreateOidcUser(normalizedProfile);
      if (!user) {
        return done(null, false); // Or handle error appropriately
      }
      return done(null, user);
    } catch (error) {
      // Check if the caught object is an instance of Error
      if (error instanceof Error) {
        return done(error, false);
      }
      // If it's not an error, create a new one with a fallback message
      const errorMessage = `An unknown error occurred during authentication: ${String(error)}`;
      return done(new Error(errorMessage), false);
    }
  }

  // Normalize the profile from the OIDC provider
  private normalizeProfile(profile: Profile): NormalizedProfile {
    // The profile object from passport-openidconnect is already quite normalized.
    // It uses the standard OIDC claims.
    return {
      provider: this.config.name,
      providerId: profile.id, // 'sub' claim is mapped to 'id'
      email: profile.emails?.[0]?.value,
      emailVerified: true, // Assuming OIDC provider verifies email
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      raw: profile._raw, // Keep the original profile for debugging or other uses
    };
  }
}
