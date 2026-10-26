import {
  AuditTrail,
  Profile,
  // RefreshToken,
  Role,
  User,
  UserSocialProfile,
  SocialProvider,
  Translation,
  TranslationKey,
  // UserIdentity,
  // IdentityProvider,
} from 'generated/prisma/client';

// export interface UserIdentityDetail extends UserIdentity {
//   provider: IdentityProvider;
//   user: SanitizedUser;
// }

export interface UserDetail extends User {
  socialProfiles: (UserSocialProfile & { provider: SocialProvider })[];
  userRole: Role;
  // identities: UserIdentityDetail[];
  profile: Profile | null;
  // refreshTokens: RefreshToken;
  auditTrail: AuditTrail;
}

export type SanitizedUser = Omit<
  UserDetail,
  'password' | 'auditTrail'
  // 'password' | 'mfaSecret' | 'identities' | 'refreshTokens' | 'auditTrail'
>;

export interface SignedUser {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
}

export type AccessToken = Omit<SignedUser, 'user' | 'refreshToken'>;

export interface TranslationDetail extends Translation {
  key: TranslationKey;
}
