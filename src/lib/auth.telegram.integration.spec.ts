import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { dash, sentinel } from '@better-auth/infra';
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
      const route = request.url?.replace(/^\/api\/v1/, '');
      response.setHeader('Content-Type', 'application/json');
      // The issuer rejects token exchanges without the required HTTP Basic client authentication.
      const expectedAuth = `Basic ${Buffer.from(['123', 'fixture-secret'].join(':')).toString('base64')}`;
      if (
        route === '/token' &&
        request.headers.authorization !== expectedAuth
      ) {
        response.statusCode = 401;
        response.end('{}');
        return;
      }
      if (route === '/identify/fixture-device-request') {
        response.end(
          JSON.stringify({
            visitorId: 'fixture-device',
            requestId: 'fixture-device-request',
            ip: '127.0.0.1',
          }),
        );
        return;
      }
      if (route?.startsWith('/security/') || route?.startsWith('/events')) {
        response.end(
          JSON.stringify({
            reserved: true,
            isAbuse: false,
            action: 'allow',
            accountCount: 0,
            maxAccounts: 3,
          }),
        );
        return;
      }
      if (route === '/discovery')
        response.end(
          JSON.stringify({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            jwks_uri: `${origin}/jwks`,
            id_token_signing_alg_values_supported: ['RS256'],
          }),
        );
      else if (route === '/jwks') response.end(JSON.stringify({ keys: [jwk] }));
      else if (route === '/token')
        response.end(
          JSON.stringify({
            access_token: randomBytes(24).toString('hex'),
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
  function fixture(withSentinel = false) {
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
        ...(withSentinel
          ? [
              dash({
                apiKey: randomBytes(24).toString('hex'),
                apiUrl: origin,
                kvUrl: origin,
                kvOptions: {
                  timeout: 500,
                  retry: { attempts: 0, baseDelay: 0, maxDelay: 0 },
                },
              }),
              sentinel({
                apiKey: randomBytes(24).toString('hex'),
                apiUrl: origin,
                kvUrl: origin,
                kvOptions: {
                  timeout: 500,
                  retry: { attempts: 0, baseDelay: 0, maxDelay: 0 },
                },
                security: {
                  freeTrialAbuse: { enabled: true, maxAccountsPerVisitor: 3 },
                },
              }),
            ]
          : []),
        genericOAuth({
          config: [{ ...configured, discoveryUrl: `${origin}/discovery` }],
        }),
      ],
    });
    return { auth, store };
  }

  /** Begins authorization and preserves the browser state cookie for the callback. */
  async function begin(
    auth: ReturnType<typeof fixture>['auth'],
    identified: boolean | 'rewritten' | 'forged' = false,
  ) {
    const response = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          ...(identified
            ? {
                'X-Request-Id': 'gateway-generated-id',
                'X-Visitor-Id': 'fixture-device',
                ...(identified === 'rewritten'
                  ? {}
                  : {
                      'X-Sentinel-Request-Id':
                        identified === 'forged'
                          ? 'missing-device-record'
                          : 'fixture-device-request',
                      'X-Sentinel-Visitor-Id': 'untrusted-client-visitor',
                    }),
              }
            : {}),
        },
        body: JSON.stringify({
          provider: 'telegram',
          callbackURL: `${origin}/dashboard`,
          disableRedirect: true,
        }),
      }),
    );
    if (response.status !== 200) throw new Error(await response.text());
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

  /** Requires an authorization parameter instead of asserting away a missing value. */
  function requiredParameter(url: URL, name: string): string {
    const value = url.searchParams.get(name);
    if (!value) throw new Error(`Missing authorization parameter: ${name}`);
    return value;
  }
  /** Exchanges a test authorization code using the state and cookie from the login attempt. */
  function finish(
    auth: ReturnType<typeof fixture>['auth'],
    attempt: Awaited<ReturnType<typeof begin>>,
    error?: string,
  ) {
    const query = new URLSearchParams({
      state: requiredParameter(attempt.url, 'state'),
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
  function issue(
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
      tokenResponse = await issue(requiredParameter(attempt.url, 'nonce'));
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
              requiredParameter(attempt.url, 'nonce'),
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
  it('carries verified Sentinel identification across the OAuth callback', async () => {
    const { auth, store } = fixture(true);
    const attempt = await begin(auth, true);
    const infraCookie = attempt.cookie
      .split(/;\s*/)
      .find((value) => value.startsWith('__infra-rid='));
    expect(infraCookie).toBeDefined();
    expect(
      decodeURIComponent(infraCookie?.slice('__infra-rid='.length) ?? ''),
    ).toBe('fixture-device-request');
    tokenResponse = await issue(requiredParameter(attempt.url, 'nonce'));
    const response = await finish(auth, attempt);
    expect(response.headers.get('location')).toBe(origin + '/dashboard');
    expect(store.user).toHaveLength(1);
  });

  it('keeps new-account creation blocked without a verified Sentinel device', async () => {
    const { auth, store } = fixture(true);
    const attempt = await begin(auth);
    tokenResponse = await issue(requiredParameter(attempt.url, 'nonce'));
    const response = await finish(auth, attempt);
    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      'Account creation is not allowed without device identification.',
    );
    expect(store.user).toHaveLength(0);
  });
  it.each(['rewritten', 'forged'] as const)(
    'does not create accounts for an unverified %s request id',
    async (mode) => {
      const { auth, store } = fixture(true);
      const attempt = await begin(auth, mode);
      tokenResponse = await issue(requiredParameter(attempt.url, 'nonce'));
      const response = await finish(auth, attempt);
      expect(response.status).toBe(403);
      expect(store.user).toHaveLength(0);
      expect(store.session).toHaveLength(0);
    },
  );
});
