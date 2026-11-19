import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

const clients: FakeClient[] = [];
let triggerCount = 3;
class FakeClient extends EventEmitter {
  connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  query = jest
    .fn<() => Promise<{ rows: { count: number }[] }>>()
    .mockResolvedValue({ rows: [{ count: triggerCount }] });
  end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  constructor() {
    super();
    clients.push(this);
  }
}
jest.unstable_mockModule('pg', () => ({ Client: FakeClient }));
const { RealtimeBus } = await import('./realtime-bus.service');
const { resyncEvent } = await import('./realtime.contract');
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const original = {
  enabled: process.env.REALTIME_ENABLED,
  url: process.env.REALTIME_DATABASE_URL,
};
afterEach(() => {
  if (original.enabled === undefined) delete process.env.REALTIME_ENABLED;
  else process.env.REALTIME_ENABLED = original.enabled;
  if (original.url === undefined) delete process.env.REALTIME_DATABASE_URL;
  else process.env.REALTIME_DATABASE_URL = original.url;
  clients.length = 0;
  triggerCount = 3;
  jest.useRealTimers();
});

it('does not connect when off and requires an explicit session URL when enabled', async () => {
  delete process.env.REALTIME_ENABLED;
  const bus = new RealtimeBus();
  await bus.onModuleInit();
  expect(clients).toHaveLength(0);
  process.env.REALTIME_ENABLED = 'true';
  delete process.env.REALTIME_DATABASE_URL;
  await expect(bus.onModuleInit()).rejects.toThrow('dedicated');
  await bus.onModuleDestroy();
});

it('keeps readiness false when the database migration is missing', async () => {
  jest.useFakeTimers();
  process.env.REALTIME_ENABLED = 'true';
  process.env.REALTIME_DATABASE_URL = 'postgres://test';
  triggerCount = 0;
  const bus = new RealtimeBus();
  await bus.onModuleInit();
  expect(bus.ready).toBe(false);
  expect(clients[0].query).not.toHaveBeenCalledWith('LISTEN datatable_live_v1');
  await bus.onModuleDestroy();
  expect(jest.getTimerCount()).toBe(0);
});

it('LISTENs once, rejects malformed messages, reconnects with resync, and cleans up', async () => {
  jest.useFakeTimers();
  process.env.REALTIME_ENABLED = 'true';
  process.env.REALTIME_DATABASE_URL = 'postgres://test';
  const bus = new RealtimeBus(),
    received = jest.fn();
  bus.notifications.subscribe(received);
  await bus.onModuleInit();
  expect(bus.ready).toBe(true);
  expect(clients[0].query).toHaveBeenCalledWith('LISTEN datatable_live_v1');
  expect(clients[0].query).toHaveBeenCalledWith(
    expect.stringContaining(
      "to_regprocedure('public.notify_translation_table_live_v1()')",
    ),
  );
  expect(clients[0].query).toHaveBeenCalledWith(
    expect.stringContaining("('translation_values_live_v1', 'translations')"),
  );
  const event = resyncEvent();
  clients[0].emit('notification', {
    channel: 'datatable_live_v1',
    payload: JSON.stringify(event),
  });
  clients[0].emit('notification', {
    channel: 'datatable_live_v1',
    payload: '{}',
  });
  expect(received).toHaveBeenCalledTimes(2);
  clients[0].emit('error', new Error('gone'));
  clients[0].emit('end');
  expect(bus.ready).toBe(false);
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(1000);
  await flush();
  expect(clients).toHaveLength(2);
  expect(bus.ready).toBe(true);
  expect(received).toHaveBeenCalledTimes(4);
  await bus.onModuleDestroy();
  expect(jest.getTimerCount()).toBe(0);
  expect(clients[1].end).toHaveBeenCalledTimes(1);
});

it('keeps validated document notifications off the translation stream', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    REALTIME_ENABLED: 'true',
    REALTIME_DATABASE_URL: 'postgres://test',
    DOCUMENT_REALTIME_ENABLED: 'true',
  });
  const bus = new RealtimeBus();
  const translations = jest.fn();
  const documents = jest.fn();
  bus.notifications.subscribe(translations);
  bus.documentNotifications.subscribe(documents);
  try {
    await bus.onModuleInit();
    expect(clients[0].query).toHaveBeenCalledWith(
      'LISTEN document_tracking_live_v1',
    );
    const event = {
      version: 1,
      eventId: 'd10c3043-b54c-468a-8c03-1b430ecf4fc0',
      documentId: '9effeda2-04a5-4e48-bb34-49834d302f9c',
      previousAssignees: [42],
      occurredAt: '2026-11-17T02:00:00.000Z',
    };
    for (const payload of [event, { ...event, previousAssignees: [-1] }]) {
      clients[0].emit('notification', {
        channel: 'document_tracking_live_v1',
        payload: JSON.stringify(payload),
      });
    }
    expect(documents).toHaveBeenCalledTimes(2);
    expect(documents).toHaveBeenNthCalledWith(1, null);
    expect(documents).toHaveBeenNthCalledWith(2, event);
    expect(translations).toHaveBeenCalledTimes(1);
    expect(translations).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'translations', reason: 'resync' }),
    );
  } finally {
    await bus.onModuleDestroy();
    env.restore();
  }
});
