import {
  AuditTrail,
  Profile,
  RefreshToken,
  Role,
  User,
  UserIdentity,
} from '@prisma/client';

export interface UserDetail extends User {
  role: Role;
  identities: UserIdentity[];
  profile: Profile | null;
  refreshTokens: RefreshToken;
  auditTrail: AuditTrail;
}

export interface SignedUser {
  user?: UserDetail;
  token: string;
  refreshToken: string;
}
