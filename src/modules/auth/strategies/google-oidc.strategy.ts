// // src/auth/strategies/google-oidc.strategy.ts
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy } from 'passport-google-oidc';
// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { AuthService } from '../services/auth.service';
// // import { AuthService } from '../auth.service';

// @Injectable()
// export class GoogleOidcStrategy extends PassportStrategy(
//   Strategy,
//   'google-oidc',
// ) {
//   constructor(
//     cfg: ConfigService,
//     private authService: AuthService,
//   ) {
//     super({
//       clientID: cfg.get<string>('GOOGLE_CLIENT_ID'),
//       clientSecret: cfg.get<string>('GOOGLE_CLIENT_SECRET'),
//       callbackURL: cfg.get<string>('GOOGLE_CALLBACK_URL'),
//       scope: ['openid', 'email', 'profile'],
//       state: true,
//       passReqToCallback: false,
//     });
//   }

//   // profile contains { id(sub), displayName, emails[], photos[] }
//   async validate(issuer: string, profile: any) {
//     const email = profile.emails?.[0]?.value?.toLowerCase();
//     const sub = profile.id;
//     const displayName = profile.displayName;
//     const avatarUrl = profile.photos?.[0]?.value;

//     const user = await this.authService.validateOrLinkGoogleUser({
//       googleId: sub,
//       email,
//       emailVerified: true,
//       displayName,
//       avatarUrl,
//     });

//     return user;
//   }
// }
