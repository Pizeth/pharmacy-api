export interface Token {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
}
