import type { SentinelOptions } from '@better-auth/infra';

/** Browser ingestion is project-scoped; authenticated server KV calls use its origin. */
export function getSentinelOptions(
  env: NodeJS.ProcessEnv = process.env,
): SentinelOptions {
  const identifyUrl = env.BETTER_AUTH_IDENTIFY_URL?.trim();
  return {
    apiKey: env.BETTER_AUTH_API_KEY,
    kvUrl:
      env.BETTER_AUTH_KV_URL?.trim() ||
      (identifyUrl ? new URL(identifyUrl).origin : undefined),
    apiOptions: { timeout: 3000 },
    kvOptions: {
      timeout: 2000,
      retry: { attempts: 2, baseDelay: 400, maxDelay: 1000 },
    },
    security: {
      challengeDifficulty: 18,
      credentialStuffing: {
        enabled: true,
        action: 'challenge',
        thresholds: { challenge: 3, block: 10 },
        windowSeconds: 3600,
        cooldownSeconds: 900,
      },
      botBlocking: { action: 'challenge' },
      // Temporary: hosted Sentinel blocks password login for an allowlisted IP even with challenge configured.
      suspiciousIpBlocking: { action: 'log' },
      // Shared office IPs and VPNs can generate false positives: observe first.
      impossibleTravel: { enabled: true, maxSpeedKmh: 1000, action: 'log' },
      velocity: {
        enabled: true,
        action: 'log',
        maxSignupsPerVisitor: 5,
        maxPasswordResetsPerIp: 10,
        maxSignInsPerIp: 100,
        windowSeconds: 3600,
      },
      emailValidation: { enabled: true, strictness: 'medium', action: 'log' },
      // Do not rewrite existing account identifiers (Gmail dots/plus aliases).
      emailNormalization: { enabled: false },
      // haveIBeenPwned() already enforces breached-password checks in auth.ts.
      compromisedPassword: { enabled: false },
      freeTrialAbuse: {
        enabled: true,
        thresholds: { challenge: 2, block: 3 },
        maxAccountsPerVisitor: 3,
        retentionSeconds: 90 * 24 * 60 * 60,
        action: 'challenge',
      },
      geoBlocking: { denyList: ['TH'], action: 'block' },
      staleUsers: {
        enabled: true,
        staleDays: 90,
        action: 'log',
        notifyUser: false,
        notifyAdmin: false,
      },
      // Enabled for SDK support; infra 0.4.22 currently stubs device detection.
      unknownDeviceNotification: true,
    },
  };
}
