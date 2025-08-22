import {
  AuditTrail,
  Profile,
  RefreshToken,
  Role,
  User,
  UserIdentity,
  IdentityProvider,
} from '@prisma/client';

interface UserIdentityDetail extends UserIdentity {
  provider: IdentityProvider;
}

export interface UserDetail extends User {
  role: Role;
  identities: UserIdentityDetail[];
  profile: Profile | null;
  refreshTokens: RefreshToken;
  auditTrail: AuditTrail;
}

export interface SignedUser {
  user?: UserDetail;
  token: string;
  refreshToken: string;
}
