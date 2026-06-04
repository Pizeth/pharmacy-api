import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-strategy';
import * as oidc from 'openid-client';
import { IdentityProvider } from '@prisma/client';
import {
  NormalizedProfile,
  OidcTokens,
} from 'src/modules/ocid/interfaces/oidc.interface';

@Injectable()
export class DynamicOidcStrategy extends PassportStrategy(
  Strategy,
  'dynamic-oidc',
) {
  constructor() {
    super();
  }

  /**
   * This method is called AFTER authentication by Passport
   * It receives the user object that was returned by your verify function
   */
  async validate(
    tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
    sub: string,
    provider: IdentityProvider,
    config: oidc.Configuration,
  ) {
    // In your verify function, you should have returned the user object
    // This is where you can do additional validation if needed

    // // Fetch user info
    const userinfo = await oidc.fetchUserInfo(config, tokens.access_token, sub);

    // // Normalize user profile
    const normalizedProfile = this.normalizeProfile(provider, userinfo);

    // Calculate token expiration
    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    // Create OIDC tokens object
    const oidcTokens: OidcTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt,
    };

    const user = {
      profile: normalizedProfile,
      claim: oidcTokens,
    };

    return user;
  }

  /**
   * Normalize user profile from different OIDC providers
   */
  private normalizeProfile(
    provider: IdentityProvider,
    userinfo: oidc.UserInfoResponse,
  ): NormalizedProfile {
    // Construct the full name if the name object exists, otherwise use displayName
    const displayName =
      userinfo.name ||
      `${userinfo.given_name || ''} ${userinfo.middle_name || ''} ${userinfo.family_name || ''}`.trim() ||
      userinfo.nickname ||
      userinfo.preferred_username ||
      userinfo.email?.split('@')[0];

    return {
      id: userinfo.sub,
      providerId: provider.id,
      provider: provider.name,
      username: userinfo.preferred_username,
      name: userinfo.name,
      displayName,
      email: userinfo.email || '',
      emailVerified: userinfo.email_verified || false,
      profile: userinfo.profile,
      picture: userinfo.picture,
      claim: userinfo.claims,
      raw: userinfo,
    };
  }
}
