import { AuditTrail, Profile, RefreshToken, Role, User } from '@prisma/client';

export interface UserDetail extends User {
  role: Role;
  profile: Profile | null;
  refreshTokens: RefreshToken;
  auditTrail: AuditTrail;
}

export interface SignedUser {
  user?: UserDetail;
  token: string;
  refreshToken: string;
}
