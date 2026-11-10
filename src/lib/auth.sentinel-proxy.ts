import type { BetterAuthPlugin } from 'better-auth';

/** Let redirect callbacks resolve Sentinel's verified cookie instead of a gateway trace ID. */
export function sentinelProxyHeaders(): BetterAuthPlugin {
  return {
    id: 'sentinel-proxy-headers',
    onRequest: (request, ctx) => {
      const basePath = new URL(ctx.baseURL).pathname.replace(/\/$/, '');
      const pathname = new URL(request.url).pathname;
      const path = pathname.startsWith(`${basePath}/`)
        ? pathname.slice(basePath.length)
        : '';
      if (
        request.method !== 'GET' ||
        !/^\/(?:callback|oauth2\/callback)\/[^/]+\/?$/.test(path) ||
        request.headers.has('X-Sentinel-Request-Id') ||
        !request.headers.has('X-Request-Id')
      ) {
        return Promise.resolve();
      }

      // Redirects cannot carry browser identification headers. The SDK still
      // loads and verifies __infra-rid through KV; no identity is manufactured.
      const headers = new Headers(request.headers);
      headers.delete('X-Request-Id');
      return Promise.resolve({ request: new Request(request, { headers }) });
    },
  };
}
