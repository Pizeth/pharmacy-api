// import { AuthService } from 'src/modules/auth/services/auth.service';
// import { OIDCProviderConfig } from '../interfaces/oidc.interface';

// import { OIDCProviderConfig } from '../interfaces/oidc.interface';

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

import { Profile, Strategy, VerifyCallback } from 'passport-openidconnect';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/services/auth.service';
// import { OidcConfigService } from '../services/oidc-config.service';
import { NormalizedProfile } from '../interfaces/oidc.interface';
import { IdentityProvider } from '@prisma/client';
import { OidcProviderService } from '../services/oidc-provider.service';
import { OidcProviderService } from '../services/oidc-provider.service';

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
@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    private readonly authService: AuthService,
    private readonly providerService: OidcProviderService,
    private readonly providerService: OidcProviderService,
    private readonly provider: IdentityProvider,
  ) {
    super({
      issuer: provider.issuer,
      authorizationURL: provider.authorizationURL,
      tokenURL: provider.tokenURL,
      userInfoURL: provider.userInfoURL,
      clientID: provider.clientID,
      clientSecret: provider.clientSecret,
      callbackURL: provider.callbackURL,
      scope: provider.scope?.split(',').map((s) => s.trim()),
      passReqToCallback: false, // Set to false, we don't need the req object in validate
    });

    // Dynamically set the strategy name
    this.name = provider.name;
  }

  // The validate function that passport-openidconnect will call
  async validate(
    issuer: string,
    issuer: string,
    profile: Profile,
    // idToken: string | object,
    // accessToken: string,
    // refreshToken: string,
    // expiresAt: Date,
    // idToken: string | object,
    // accessToken: string,
    // refreshToken: string,
    // expiresAt: Date,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const normalizedProfile = await this.normalizeProfile(profile, issuer);
      // const tokens = {
      //   accessToken,
      //   refreshToken,
      //   // idToken:
      //   //   typeof idToken === 'string' ? idToken : JSON.stringify(idToken),
      //   expiresAt,
      // };
      const user = await this.authService.oidcLogin(
      const normalizedProfile = await this.normalizeProfile(profile, issuer);
      // const tokens = {
      //   accessToken,
      //   refreshToken,
      //   // idToken:
      //   //   typeof idToken === 'string' ? idToken : JSON.stringify(idToken),
      //   expiresAt,
      // };
      const user = await this.authService.oidcLogin(
        this.provider.name,
        normalizedProfile,
        // tokens,
        // tokens,
      );

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

  // async validate(
  //   issuer: string,
  //   profile: any,
  //   context: any, // Contains tokens
  //   done: VerifyCallback,
  // ): Promise<any> {
  //   try {
  //     const normalizedProfile = this.normalizeProfile(profile);
  //     const tokens = {
  //       accessToken: context.accessToken,
  //       refreshToken: context.refreshToken,
  //       expiresAt: context.expiresAt
  //         ? new Date(context.expiresAt * 1000)
  //         : undefined,
  //     };

  //     const user = await this.authService.findOrCreateOidcUser(
  //       this.name,
  //       normalizedProfile,
  //       tokens,
  //     );

  //     if (!user) {
  //       return done(new Error('User not found or created'), false);
  //     }

  //     return done(null, user);
  //   } catch (error) {
  //     return done(error, false);
  //   }
  // }

  // Normalize the profile from the OIDC provider
  // private normalizeProfile(profile: Profile): NormalizedProfile {
  //   // The profile object from passport-openidconnect is already quite normalized.
  //   // It uses the standard OIDC claims.
  //   return {
  //     provider: this.provider.name,
  //     providerId: profile.id, // 'sub' claim is mapped to 'id'
  //     email: profile.emails?.[0]?.value,
  //     // emailVerified: true, // Assuming OIDC provider verifies email
  //     emailVerified: profile.emails?.[0]?.verified || false,
  //     name: profile.displayName,
  //     picture: profile.photos?.[0]?.value,
  //     raw: profile._raw, // Keep the original profile for debugging or other uses
  //   };
  // }

  private async normalizeProfile(
    profile: Profile,
    issuer: string,
  ): Promise<NormalizedProfile> {
  private async normalizeProfile(
    profile: Profile,
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
      provider,
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
      raw: profile,
    };
  }

  private async extractProviderName(
    issuer: string,
  ): Promise<string | undefined> {
    const providers = await this.providerService.getAllEnabledProviders();
    // Map common OIDC issuers to provider names
    // const providerMap: Record<string, string> = {
    //   'https://accounts.google.com': 'google',
    //   'https://login.microsoftonline.com': 'microsoft',
    //   'https://auth0.com': 'auth0',
    //   'https://login.salesforce.com': 'salesforce',
    //   'https://appleid.apple.com': 'apple',
    // };

    // for (const [issuerPattern, provider] of Object.entries(providerMap)) {
    //   if (issuer.includes(issuerPattern)) {
    //     return provider;
    //   }
    // }

    for (const provider of providers) {
      if (issuer.includes(provider.issuer)) {
        return provider.name;
      }
    }

    // Extract domain as fallback
    try {
      const url = new URL(issuer);
      return url.hostname.replace(/^(www\.|auth\.|login\.)/, '').split('.')[0];
    } catch {
      return undefined;
    }
  }

  private async extractProviderName(
    issuer: string,
  ): Promise<string | undefined> {
    const providers = await this.providerService.getAllEnabledProviders();
    // Map common OIDC issuers to provider names
    // const providerMap: Record<string, string> = {
    //   'https://accounts.google.com': 'google',
    //   'https://login.microsoftonline.com': 'microsoft',
    //   'https://auth0.com': 'auth0',
    //   'https://login.salesforce.com': 'salesforce',
    //   'https://appleid.apple.com': 'apple',
    // };

    // for (const [issuerPattern, provider] of Object.entries(providerMap)) {
    //   if (issuer.includes(issuerPattern)) {
    //     return provider;
    //   }
    // }

    for (const provider of providers) {
      if (issuer.includes(provider.issuer)) {
        return provider.name;
      }
    }

    // Extract domain as fallback
    try {
      const url = new URL(issuer);
      return url.hostname.replace(/^(www\.|auth\.|login\.)/, '').split('.')[0];
    } catch {
      return undefined;
    }
  }
}
