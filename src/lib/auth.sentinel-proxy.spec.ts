import type { BetterAuthPlugin } from 'better-auth';
import { sentinelProxyHeaders } from './auth.sentinel-proxy';

type RequestHook = NonNullable<BetterAuthPlugin['onRequest']>;
const context = {
  baseURL: 'https://api.example.test/custom/auth',
} as Parameters<RequestHook>[1];

describe('Sentinel OAuth proxy headers', () => {
  const hook = sentinelProxyHeaders().onRequest!;

  it.each(['callback/telegram', 'oauth2/callback/telegram'])(
    'preserves the browser cookie and unrelated headers on %s',
    async (path) => {
      const request = new Request(
        `${context.baseURL}/${path}?state=test-state`,
        {
          headers: {
            'X-Request-Id': 'gateway-trace',
            Cookie: '__infra-rid=verified-lookup',
            'X-Forwarded-For': '192.0.2.10',
          },
        },
      );
      const result = await hook(request, context);
      if (!result || !('request' in result))
        throw new Error('Expected normalized request');
      expect(result.request.headers.has('X-Request-Id')).toBe(false);
      expect(result.request.headers.get('Cookie')).toBe(
        '__infra-rid=verified-lookup',
      );
      expect(result.request.headers.get('X-Forwarded-For')).toBe('192.0.2.10');
      expect(result.request.url).toBe(request.url);
      expect(request.headers.get('X-Request-Id')).toBe('gateway-trace');
    },
  );

  it.each([
    ['POST', '/custom/auth/sign-in/social'],
    ['POST', '/custom/auth/callback/telegram'],
    ['GET', '/custom/auth/get-session'],
    ['GET', '/custom/auth/callback/telegram/extra'],
    ['GET', '/other/auth/callback/telegram'],
    ['GET', '/custom/auth-other/callback/telegram'],
  ])('leaves %s %s untouched', async (method, path) => {
    const request = new Request(`https://api.example.test${path}`, {
      method,
      headers: { 'X-Request-Id': 'legacy-identification-or-trace' },
    });
    expect(await hook(request, context)).toBeUndefined();
  });

  it('preserves an explicit modern identification header for SDK verification', async () => {
    const request = new Request(`${context.baseURL}/callback/telegram`, {
      headers: {
        'X-Request-Id': 'gateway-trace',
        'X-Sentinel-Request-Id': 'explicit-identification',
      },
    });
    expect(await hook(request, context)).toBeUndefined();
  });
});
