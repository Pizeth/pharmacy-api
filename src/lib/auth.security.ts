import type { BetterAuthOptions } from 'better-auth';
import { findInvalidTrustedProxies } from '@better-auth/core/utils/ip';

export const AUTH_TOKEN_STORAGE = 'hashed' as const;

/** Northflank supplies X-Forwarded-For; Cloudflare is DNS-only for this API. */
export function getAuthIpAddressOptions(
  env: NodeJS.ProcessEnv = process.env,
): NonNullable<NonNullable<BetterAuthOptions['advanced']>['ipAddress']> {
  const trustedProxies = (env.BETTER_AUTH_TRUSTED_PROXIES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (findInvalidTrustedProxies(trustedProxies).length) {
    throw new Error(
      'BETTER_AUTH_TRUSTED_PROXIES must contain valid proxy IP addresses or CIDRs.',
    );
  }
  return {
    ipAddressHeaders: ['x-forwarded-for'],
    ipv6Subnet: 64,
    ...(trustedProxies.length ? { trustedProxies } : {}),
  };
}

/** Global fallback when a per-flow callback cannot be recovered. */
export function getAuthErrorURL(env: NodeJS.ProcessEnv = process.env): string {
  const frontend =
    env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:8080';
  const origin = new URL(frontend);
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.username ||
    origin.password
  ) {
    throw new Error(
      'FRONTEND_URL must start with a valid application HTTP(S) origin.',
    );
  }
  return new URL('/auth/error', origin.origin).toString();
}
