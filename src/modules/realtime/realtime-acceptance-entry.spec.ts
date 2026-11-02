import { jest } from '@jest/globals';

const originalUrl = process.env.REALTIME_TEST_DATABASE_URL;
const clients: FakeClient[] = [];
let failConnect = false;
let failure = new Error('lost CREATE response');
class FakeClient {
  readonly index = clients.length;
  constructor() {
    clients.push(this);
  }
  connect = jest
    .fn<() => Promise<void>>()
    .mockImplementation(() =>
      failConnect && this.index === 0
        ? Promise.reject(failure)
        : Promise.resolve(),
    );
  query = jest
    .fn<(sql: string) => Promise<void>>()
    .mockImplementation((sql) =>
      sql.startsWith('CREATE SCHEMA')
        ? Promise.reject(failure)
        : Promise.resolve(),
    );
  end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
}
beforeEach(() => {
  jest.resetModules();
  clients.length = 0;
  process.env.REALTIME_TEST_DATABASE_URL = 'postgres://disposable.invalid/test';
  jest.unstable_mockModule('pg', () => ({ Client: FakeClient }));
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.REALTIME_TEST_DATABASE_URL;
  else process.env.REALTIME_TEST_DATABASE_URL = originalUrl;
});

it.each([false, true])(
  'actual harness cleanup preserves failure when connection failure=%s',
  async (connectionFailure) => {
    failConnect = connectionFailure;
    failure = new Error(
      connectionFailure ? 'connection failed' : 'lost CREATE response',
    );
    await expect(
      import('../../../scripts/realtime-postgres-acceptance.mjs'),
    ).rejects.toBe(failure);
    expect(clients).toHaveLength(3);
    for (const client of clients) expect(client.end).toHaveBeenCalledTimes(1);
    if (connectionFailure) expect(clients[0].query).not.toHaveBeenCalled();
    else
      expect(clients[0].query).toHaveBeenCalledWith(
        expect.stringMatching(
          /^DROP SCHEMA IF EXISTS live_test_[a-f0-9]+ CASCADE$/,
        ),
      );
  },
);
