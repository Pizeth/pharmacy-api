import {
  AuditTrail,
  Profile,
  RefreshToken,
  Role,
  User,
  UserIdentity,
  IdentityProvider,
} from '@prisma/client';

export interface UserIdentityDetail extends UserIdentity {
  provider: IdentityProvider;
}

export interface UserDetail extends User {
  role: Role;
  identities: UserIdentityDetail[];
  profile: Profile | null;
  refreshTokens: RefreshToken;
  auditTrail: AuditTrail;
}

export type SanitizedUser = Omit<
  UserDetail,
  'password' | 'mfaSecret' | 'identities' | 'refreshTokens' | 'auditTrail'
>;

export interface SignedUser {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
}

export type AccessToken = Omit<SignedUser, 'user' | 'refreshToken'>;
