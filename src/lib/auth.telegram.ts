import type { GenericOAuthConfig } from 'better-auth/plugins';
import { decodeJwt } from 'jose';

const TELEGRAM_PLACEHOLDER_DOMAIN = 'telegram.placeholder.invalid';

export function isTelegramPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${TELEGRAM_PLACEHOLDER_DOMAIN}`);
}

/** Maps claims only after Generic OAuth verifies the token signature, issuer, audience and nonce. */
export const getTelegramUserInfo: NonNullable<
  GenericOAuthConfig['getUserInfo']
> = (tokens) => {
  if (!tokens.idToken) return Promise.resolve(null);
  try {
    const claims = decodeJwt(tokens.idToken);
    if (typeof claims.sub !== 'string' || !/^\d+$/.test(claims.sub))
      return Promise.resolve(null);
    return Promise.resolve({
      sub: claims.sub,
      id: claims.sub,
      name:
        typeof claims.name === 'string' && claims.name.trim()
          ? claims.name
          : 'Telegram user',
      image: typeof claims.picture === 'string' ? claims.picture : undefined,
      // Telegram provides no email. Never treat its mutable username as an email or account key.
      email: `${claims.sub}@${TELEGRAM_PLACEHOLDER_DOMAIN}`,
      emailVerified: false,
    });
  } catch {
    return Promise.resolve(null);
  }
};

/** Registers Telegram only when both server-side OIDC credentials are available. */
export function createTelegramProvider(
  env: NodeJS.ProcessEnv,
): (GenericOAuthConfig & { providerId: 'telegram' }) | undefined {
  const clientId = env.TELEGRAM_CLIENT_ID?.trim();
  const clientSecret = env.TELEGRAM_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  return {
    providerId: 'telegram',
    clientId,
    clientSecret,
    tokenEndpointAuth: { method: 'client_secret_basic' },
    discoveryUrl: 'https://oauth.telegram.org/.well-known/openid-configuration',
    requireIdTokenVerification: true,
    disableImplicitSignUp: true,
    scopes: ['openid', 'profile'],
    pkce: true,
    getUserInfo: getTelegramUserInfo,
  };
}
