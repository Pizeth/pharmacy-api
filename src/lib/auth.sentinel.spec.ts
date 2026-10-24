import { getSentinelOptions } from './auth.sentinel';

describe('Sentinel configuration', () => {
  it('keeps browser project ingestion separate from authenticated server KV', () => {
    const options = getSentinelOptions({
      BETTER_AUTH_IDENTIFY_URL: ' https://kv.better-auth.com/projects/test-project ',
      BETTER_AUTH_API_KEY: 'test-only-key',
    });
    expect(options.kvUrl).toBe('https://kv.better-auth.com');
    expect(options.apiKey).toBe('test-only-key');
  });

  it('allows an explicit server KV endpoint without requiring an identify URL', () => {
    expect(getSentinelOptions({ BETTER_AUTH_KV_URL: ' https://kv.example.test ' }).kvUrl)
      .toBe('https://kv.example.test');
    expect(getSentinelOptions({}).kvUrl).toBeUndefined();
  });

  it('challenges bots and repeated login failures without rewriting existing emails', () => {
    const { security } = getSentinelOptions({});
    expect(security?.credentialStuffing).toMatchObject({
      enabled: true, action: 'challenge', thresholds: { challenge: 3, block: 10 },
    });
    expect(security?.botBlocking).toEqual({ action: 'challenge' });
    expect(security?.suspiciousIpBlocking).toEqual({ action: 'log' });
    expect(security?.unknownDeviceNotification).toBe(true);
    expect(security?.geoBlocking).toEqual({ denyList: ['TH'], action: 'block' });
    expect(security?.freeTrialAbuse).toMatchObject({
      enabled: true, thresholds: { challenge: 2, block: 3 },
      maxAccountsPerVisitor: 3, retentionSeconds: 7776000,
    });
    expect(security?.compromisedPassword?.enabled).toBe(false);
    expect(security?.impossibleTravel?.action).toBe('log');
    expect(security?.velocity?.action).toBe('log');
    expect(security?.emailNormalization?.enabled).toBe(false);
    expect(security?.staleUsers).toMatchObject({ notifyUser: false, notifyAdmin: false });
  });
});
