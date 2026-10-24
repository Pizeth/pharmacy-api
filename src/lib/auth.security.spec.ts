import { getAuthErrorURL, getAuthIpAddressOptions, AUTH_TOKEN_STORAGE } from './auth.security';
import { getIPFromHeader } from '@better-auth/core/utils/ip';
import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { emailOTP, magicLink, twoFactor } from 'better-auth/plugins';

it('uses Northflank forwarding and rejects ambiguous untrusted proxy chains', () => {
  expect(getAuthIpAddressOptions({})).toEqual({ ipAddressHeaders: ['x-forwarded-for'], ipv6Subnet: 64 });
  expect(getIPFromHeader('198.51.100.23')).toBe('198.51.100.23');
  expect(getIPFromHeader('198.51.100.23, 192.0.2.10')).toBeNull();
  const options = getAuthIpAddressOptions({ BETTER_AUTH_TRUSTED_PROXIES: '192.0.2.10' });
  expect(getIPFromHeader('203.0.113.9, 198.51.100.23, 192.0.2.10', options)).toBe('198.51.100.23');
  expect(() => getAuthIpAddressOptions({ BETTER_AUTH_TRUSTED_PROXIES: 'invalid' })).toThrow();
});

it('builds an absolute frontend OAuth error URL', () => {
  expect(getAuthErrorURL({ FRONTEND_URL: 'https://app.example.test,https://preview.example.test' }))
    .toBe('https://app.example.test/auth/error');
  expect(() => getAuthErrorURL({ FRONTEND_URL: 'javascript:alert(1)' })).toThrow();
});

function memory(): MemoryDB { return { user: [], session: [], account: [], verification: [], twoFactor: [] }; }
const testBase = { baseURL: 'http://localhost:3000', secret: 'test-only-auth-hardening-secret-at-least-32-characters',
  emailAndPassword: { enabled: true }, rateLimit: { enabled: false } };

it('stores email OTP digests and verifies the delivered code', async () => {
  const db = memory(); let code = '';
  const auth = betterAuth({ ...testBase, database: memoryAdapter(db), plugins: [emailOTP({
    storeOTP: AUTH_TOKEN_STORAGE, async sendVerificationOTP(data) { code = data.otp; },
  })] });
  await auth.api.signUpEmail({ body: { name: 'Test member', email: 'member@example.test', password: 'Test-only-password-123!' } });
  await auth.api.sendVerificationOTP({ body: { email: 'member@example.test', type: 'sign-in' } });
  expect(code).toMatch(/^\d{6}$/);
  expect(JSON.stringify(db.verification)).not.toContain(code);
  await expect(auth.api.checkVerificationOTP({ body: { email: 'member@example.test', type: 'sign-in', otp: code } }))
    .resolves.toMatchObject({ success: true });
});

it('stores hashed magic-link identifiers and verifies the delivered link', async () => {
  const db = memory(); let token = ''; let url = '';
  const auth = betterAuth({ ...testBase, database: memoryAdapter(db), plugins: [magicLink({
    storeToken: AUTH_TOKEN_STORAGE, async sendMagicLink(data) { token = data.token; url = data.url; },
  })] });
  await auth.api.signInMagicLink({ body: { email: 'member@example.test', callbackURL: '/' }, headers: new Headers({ origin: 'http://localhost:3000' }) });
  expect(token).not.toBe('');
  expect(JSON.stringify(db.verification)).not.toContain(token);
  const response = await auth.handler(new Request(url));
  expect(response.status).toBe(302);
  expect(db.session).toHaveLength(1);
});

it('stores two-factor OTP digests and verifies the delivered code', async () => {
  const db = memory(); let code = '';
  const auth = betterAuth({ ...testBase, database: memoryAdapter(db), plugins: [twoFactor({
    otpOptions: { storeOTP: AUTH_TOKEN_STORAGE, async sendOTP(data) { code = data.otp; } },
  })] });
  const signup = await auth.api.signUpEmail({ body: { name: 'Test member', email: 'member@example.test', password: 'Test-only-password-123!' }, asResponse: true });
  const cookie = signup.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(cookie).not.toBe('');
  const headers = new Headers({ cookie });
  await auth.api.sendTwoFactorOTP({ body: {}, headers });
  expect(code).toMatch(/^\d{6}$/);
  expect(JSON.stringify(db.verification)).not.toContain(code);
  await expect(auth.api.verifyTwoFactorOTP({ body: { code }, headers })).resolves.toHaveProperty('token');
});
