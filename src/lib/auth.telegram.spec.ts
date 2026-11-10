import { SignJWT } from 'jose';
import {
  createTelegramProvider,
  getTelegramUserInfo,
} from './auth.telegram.js';

/** Supplies a token-shaped fixture; cryptographic verification belongs to Better Auth before mapping. */
async function token(claims: Record<string, unknown>) {
  return {
    idToken: await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(
        new TextEncoder().encode('fixture-secret-at-least-thirty-two-bytes'),
      ),
  };
}

describe('Telegram OIDC configuration', () => {
  it.each([
    {},
    { TELEGRAM_CLIENT_ID: '123' },
    { TELEGRAM_CLIENT_SECRET: 'secret' },
    { TELEGRAM_CLIENT_ID: ' ', TELEGRAM_CLIENT_SECRET: 'secret' },
  ])('does not advertise incomplete credentials: %j', (env) => {
    expect(createTelegramProvider(env)).toBeUndefined();
  });
  it('requires verified discovery tokens and PKCE with minimal supported scopes', () => {
    expect(
      createTelegramProvider({
        TELEGRAM_CLIENT_ID: '123',
        TELEGRAM_CLIENT_SECRET: 'secret',
      }),
    ).toMatchObject({
      providerId: 'telegram',
      clientId: '123',
      clientSecret: 'secret',
      pkce: true,
      requireIdTokenVerification: true,
      scopes: ['openid', 'profile'],
      discoveryUrl:
        'https://oauth.telegram.org/.well-known/openid-configuration',
    });
  });
  it('maps immutable identity without trusting an email or username claim', async () => {
    const result = await getTelegramUserInfo(
      await token({
        sub: '12345',
        name: 'Dara',
        picture: 'https://example.com/avatar.png',
        preferred_username: 'admin',
        email: 'admin@example.com',
        email_verified: true,
      }),
    );
    expect(result).toEqual({
      sub: '12345',
      id: '12345',
      name: 'Dara',
      image: 'https://example.com/avatar.png',
      email: '12345@telegram.placeholder.invalid',
      emailVerified: false,
    });
  });
  it('uses a safe display fallback and stable placeholder across username changes', async () => {
    expect(
      await getTelegramUserInfo(
        await token({ sub: '12345', preferred_username: 'changed' }),
      ),
    ).toMatchObject({
      name: 'Telegram user',
      email: '12345@telegram.placeholder.invalid',
    });
  });
  it.each([{}, { sub: '' }, { sub: 123 }, { sub: 'user@example.com' }])(
    'rejects missing or malformed Telegram subjects: %j',
    async (claims) => {
      expect(await getTelegramUserInfo(await token(claims))).toBeNull();
    },
  );
  it('rejects absent or malformed tokens', async () => {
    expect(await getTelegramUserInfo({})).toBeNull();
    expect(await getTelegramUserInfo({ idToken: 'invalid' })).toBeNull();
  });
});
