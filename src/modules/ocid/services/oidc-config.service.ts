// import { ConfigService } from '@nestjs/config';
// import { OIDCProviderConfig } from '../interfaces/oidc.interface';
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class OIDCConfigService {
//   constructor(private configService: ConfigService) {}

//   getEnabledProviders(): OIDCProviderConfig[] {
//     const providers: OIDCProviderConfig[] = [
//       {
//         name: 'google',
//         displayName: 'Google',
//         issuer: 'https://accounts.google.com',
//         clientID: this.configService.get('GOOGLE_CLIENT_ID'),
//         clientSecret: this.configService.get('GOOGLE_CLIENT_SECRET'),
//         callbackURL: this.configService.get('GOOGLE_CALLBACK_URL'),
//         scope: ['openid', 'email', 'profile'],
//         enabled: !!(
//           this.configService.get('GOOGLE_CLIENT_ID') &&
//           this.configService.get('GOOGLE_CLIENT_SECRET')
//         ),
//       },
//       {
//         name: 'microsoft',
//         displayName: 'Microsoft',
//         issuer: `https://login.microsoftonline.com/${this.configService.get('MICROSOFT_TENANT_ID', 'common')}/v2.0`,
//         authorizationURL: `https://login.microsoftonline.com/${this.configService.get('MICROSOFT_TENANT_ID', 'common')}/oauth2/v2.0/authorize`,
//         tokenURL: `https://login.microsoftonline.com/${this.configService.get('MICROSOFT_TENANT_ID', 'common')}/oauth2/v2.0/token`,
//         userInfoURL: 'https://graph.microsoft.com/v1.0/me',
//         clientID: this.configService.get('MICROSOFT_CLIENT_ID'),
//         clientSecret: this.configService.get('MICROSOFT_CLIENT_SECRET'),
//         callbackURL: this.configService.get('MICROSOFT_CALLBACK_URL'),
//         scope: ['openid', 'email', 'profile'],
//         enabled: !!(
//           this.configService.get('MICROSOFT_CLIENT_ID') &&
//           this.configService.get('MICROSOFT_CLIENT_SECRET')
//         ),
//       },
//       {
//         name: 'auth0',
//         displayName: 'Auth0',
//         issuer: `https://${this.configService.get('AUTH0_DOMAIN')}/`,
//         authorizationURL: `https://${this.configService.get('AUTH0_DOMAIN')}/authorize`,
//         tokenURL: `https://${this.configService.get('AUTH0_DOMAIN')}/oauth/token`,
//         userInfoURL: `https://${this.configService.get('AUTH0_DOMAIN')}/userinfo`,
//         clientID: this.configService.get('AUTH0_CLIENT_ID'),
//         clientSecret: this.configService.get('AUTH0_CLIENT_SECRET'),
//         callbackURL: this.configService.get('AUTH0_CALLBACK_URL'),
//         scope: ['openid', 'email', 'profile'],
//         enabled: !!(
//           this.configService.get('AUTH0_DOMAIN') &&
//           this.configService.get('AUTH0_CLIENT_ID')
//         ),
//       },
//       // Add more providers as needed
//     ];

//     return providers.filter((provider) => provider.enabled);
//   }

//   getProvider(name: string): OIDCProviderConfig | undefined {
//     return this.getEnabledProviders().find(
//       (provider) => provider.name === name,
//     );
//   }
// }

// @Injectable()
// export class OidcConfigService {
//   constructor(private configService: ConfigService) {}

//   getConfig(provider: string): OidcConfig {
//     const baseURL = this.configService.get('APP_URL');

//     return {
//       provider,
//       clientID: this.configService.get(`${provider.toUpperCase()}_CLIENT_ID`),
//       clientSecret: this.configService.get(
//         `${provider.toUpperCase()}_CLIENT_SECRET`,
//       ),
//       callbackURL: `${baseURL}/auth/${provider}/callback`,
//       scope: this.getProviderScopes(provider),
//       ...this.getProviderEndpoints(provider),
//     };
//   }

//   private getProviderScopes(provider: string): string[] {
//     switch (provider) {
//       case 'google':
//         return ['openid', 'email', 'profile'];
//       case 'facebook':
//         return ['email'];
//       case 'microsoft':
//         return ['openid', 'email', 'profile'];
//       case 'apple':
//         return ['email', 'name'];
//       default:
//         return ['openid', 'email'];
//     }
//   }

//   private getProviderEndpoints(provider: string) {
//     switch (provider) {
//       case 'google':
//         return {
//           authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
//           tokenURL: 'https://oauth2.googleapis.com/token',
//           userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
//         };
//       case 'facebook':
//         return {
//           authorizationURL: 'https://www.facebook.com/v12.0/dialog/oauth',
//           tokenURL: 'https://graph.facebook.com/v12.0/oauth/access_token',
//           userInfoURL:
//             'https://graph.facebook.com/v12.0/me?fields=id,email,name,picture',
//         };
//       case 'microsoft':
//         return {
//           authorizationURL:
//             'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
//           tokenURL:
//             'https://login.microsoftonline.com/common/oauth2/v2.0/token',
//           userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
//         };
//       case 'apple':
//         return {
//           authorizationURL: 'https://appleid.apple.com/auth/authorize',
//           tokenURL: 'https://appleid.apple.com/auth/token',
//         };
//       default:
//         return {};
//     }
//   }
// }
