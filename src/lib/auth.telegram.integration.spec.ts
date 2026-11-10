import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { genericOAuth } from 'better-auth/plugins';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createTelegramProvider } from './auth.telegram.js';

/** Exercises real Better Auth verification against a local OIDC issuer without production data. */
describe('Telegram OIDC callback verification', () => {
  let server: Server;
  let origin: string;
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let foreignKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let tokenResponse = '';
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    foreignKeys = await generateKeyPair('RS256');
    const jwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'fixture',
      alg: 'RS256',
    };
    server = createServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/discovery')
        response.end(
          JSON.stringify({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            jwks_uri: `${origin}/jwks`,
            id_token_signing_alg_values_supported: ['RS256'],
          }),
        );
      else if (request.url === '/jwks')
        response.end(JSON.stringify({ keys: [jwk] }));
      else if (request.url === '/token')
        response.end(
          JSON.stringify({
            access_token: 'fixture-access',
            token_type: 'Bearer',
            id_token: tokenResponse,
          }),
        );
      else {
        response.statusCode = 404;
        response.end('{}');
      }
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing fixture address');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  /** Creates an isolated auth store using the production provider options and local discovery. */
  function fixture() {
    const store: Record<string, Record<string, unknown>[]> = {
      user: [],
      account: [],
      session: [],
      verification: [],
    };
    const configured = createTelegramProvider({
      TELEGRAM_CLIENT_ID: '123',
      TELEGRAM_CLIENT_SECRET: 'fixture-secret',
    });
    if (!configured) throw new Error('Missing fixture config');
    const auth = betterAuth({
      baseURL: origin,
      secret: randomBytes(32).toString('hex'),
      database: memoryAdapter(store),
      logger: { disabled: true },
      plugins: [
        genericOAuth({
          config: [{ ...configured, discoveryUrl: `${origin}/discovery` }],
        }),
      ],
    });
    return { auth, store };
  }

  /** Begins authorization and preserves the browser state cookie for the callback. */
  async function begin(auth: ReturnType<typeof fixture>['auth']) {
    const response = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          provider: 'telegram',
          callbackURL: `${origin}/dashboard`,
          disableRedirect: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    const url = new URL(body.url);
    return {
      url,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }

  /** Exchanges a test authorization code using the state and cookie from the login attempt. */
  async function finish(
    auth: ReturnType<typeof fixture>['auth'],
    attempt: Awaited<ReturnType<typeof begin>>,
    error?: string,
  ) {
    const query = new URLSearchParams({
      state: attempt.url.searchParams.get('state')!,
    });
    if (error) query.set('error', error);
    else query.set('code', 'fixture-code');
    return auth.handler(
      new Request(`${origin}/api/auth/callback/telegram?${query}`, {
        headers: { cookie: attempt.cookie },
      }),
    );
  }

  /** Signs a locally issued token with independently overridable verification claims. */
  async function issue(
    nonce: string,
    overrides: Record<string, unknown> = {},
    foreign = false,
  ) {
    return new SignJWT({ sub: '12345', name: 'Dara', nonce, ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
      .setIssuedAt()
      .setIssuer(typeof overrides.iss === 'string' ? overrides.iss : origin)
      .setAudience(typeof overrides.aud === 'string' ? overrides.aud : '123')
      .setExpirationTime(
        typeof overrides.exp === 'number'
          ? overrides.exp
          : Math.floor(Date.now() / 1000) + 300,
      )
      .sign(foreign ? foreignKeys.privateKey : keys.privateKey);
  }

  it('uses PKCE, nonce, state and the exact callback, and reuses a verified account', async () => {
    const { auth, store } = fixture();
    for (let run = 0; run < 2; run++) {
      const attempt = await begin(auth);
      expect(attempt.url.searchParams.get('redirect_uri')).toBe(
        `${origin}/api/auth/callback/telegram`,
      );
      expect(attempt.url.searchParams.get('scope')).toBe('openid profile');
      expect(attempt.url.searchParams.get('state')).toBeTruthy();
      expect(attempt.url.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
      expect(attempt.url.searchParams.get('code_challenge')).toBeTruthy();
      const nonce = attempt.url.searchParams.get('nonce');
      expect(nonce).toBeTruthy();
      tokenResponse = await issue(nonce!);
      const response = await finish(auth, attempt);
      expect(response.headers.get('location')).toBe(`${origin}/dashboard`);
    }
    expect(store.user).toHaveLength(1);
    expect(store.account).toHaveLength(1);
    expect(store.user[0]).toMatchObject({
      email: '12345@telegram.placeholder.invalid',
      emailVerified: false,
    });
    expect(store.user[0].role).toBeUndefined();
  });

  it.each([
    'signature',
    'expired',
    'issuer',
    'audience',
    'nonce',
    'missing-token',
  ])(
    'rejects %s failures without creating a user or session',
    async (failure) => {
      const { auth, store } = fixture();
      const attempt = await begin(auth);
      const overrides =
        failure === 'expired'
          ? { exp: 1 }
          : failure === 'issuer'
            ? { iss: 'https://wrong.example' }
            : failure === 'audience'
              ? { aud: 'wrong' }
              : failure === 'nonce'
                ? { nonce: 'wrong' }
                : {};
      tokenResponse =
        failure === 'missing-token'
          ? ''
          : await issue(
              attempt.url.searchParams.get('nonce')!,
              overrides,
              failure === 'signature',
            );
      const response = await finish(auth, attempt);
      expect(response.headers.get('location')).not.toBe(`${origin}/dashboard`);
      expect(store.user ?? []).toHaveLength(0);
      expect(store.session ?? []).toHaveLength(0);
    },
  );

  it('cancels authorization without creating an account or session', async () => {
    const { auth, store } = fixture();
    const attempt = await begin(auth);
    await finish(auth, attempt, 'access_denied');
    expect(store.user ?? []).toHaveLength(0);
    expect(store.session ?? []).toHaveLength(0);
  });
});
