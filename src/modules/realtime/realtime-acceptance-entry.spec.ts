import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

const originalUrl = process.env.REALTIME_TEST_DATABASE_URL;
const clients: FakeClient[] = [];
let failConnect = false;
let connectedFailureIndex: number | undefined;
let delayedConnect: Promise<void> | undefined;
let failure = new Error('lost CREATE response');
class FakeClient extends EventEmitter {
  readonly index = clients.length;
  constructor() {
    super();
    clients.push(this);
  }
  connect = jest
    .fn<() => Promise<void>>()
    .mockImplementation(() =>
      failConnect && this.index === 0
        ? Promise.reject(failure)
        : this.index === 2 && delayedConnect
          ? delayedConnect
          : Promise.resolve(),
    );
  query = jest
    .fn<(sql: string) => Promise<void>>()
    .mockImplementation((sql) => {
      if (!sql.startsWith('CREATE SCHEMA')) return Promise.resolve();
      if (connectedFailureIndex !== undefined) {
        clients[connectedFailureIndex].emit('error', failure);
        return Promise.resolve();
      }
      return Promise.reject(failure);
    });
  end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
}
beforeEach(() => {
  jest.resetModules();
  clients.length = 0;
  failConnect = false;
  connectedFailureIndex = undefined;
  delayedConnect = undefined;
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

it('waits for a delayed connection before closing clients after another connect rejects', async () => {
  failConnect = true;
  failure = new Error('first connection failed');
  let finish!: () => void;
  delayedConnect = new Promise((resolve) => {
    finish = resolve;
  });
  const opening = import('../../../scripts/realtime-postgres-acceptance.mjs');
  const rejection = expect(opening).rejects.toBe(failure);
  try {
    const until = Date.now() + 1000;
    while (clients.length !== 3 && Date.now() < until)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(clients).toHaveLength(3);
    for (const client of clients) expect(client.end).not.toHaveBeenCalled();
  } finally {
    finish();
  }
  await rejection;
  for (const client of clients) expect(client.end).toHaveBeenCalledTimes(1);
});

it.each([0, 1, 2])(
  'routes connected client %s error through schema cleanup and failure propagation',
  async (index) => {
    connectedFailureIndex = index;
    failure = new Error('connected client disconnected');
    await expect(
      import('../../../scripts/realtime-postgres-acceptance.mjs'),
    ).rejects.toBe(failure);
    for (const client of clients) {
      expect(client.listenerCount('error')).toBe(1);
      expect(client.end).toHaveBeenCalledTimes(1);
    }
    expect(clients[0].query).toHaveBeenCalledWith(
      expect.stringMatching(
        /^DROP SCHEMA IF EXISTS live_test_[a-f0-9]+ CASCADE$/,
      ),
    );
  },
);
