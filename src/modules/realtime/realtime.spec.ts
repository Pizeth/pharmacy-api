import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Subject } from 'rxjs';
import type { Request, Response } from 'express';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import type { Auth } from 'lib/auth';
import { CaslAbilityFactory } from 'modules/authorization/casl/casl-ability.factory';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import { RealtimeAccess } from './realtime-access.service';
import type { RealtimeBus } from './realtime-bus.service';
import { RealtimeController } from './realtime.controller';
import {
  parseRealtimeEvent,
  resyncEvent,
  type RealtimeEvent,
} from './realtime.contract';

const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
function setup() {
  const events = new Subject<RealtimeEvent>();
  const bus = {
    enabled: true,
    ready: true,
    notifications: events.asObservable(),
  };
  const access = {
    assertRead: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  const request = Object.assign(new EventEmitter(), {
    headers: { origin: 'http://localhost:8080', cookie: 'session' },
  });
  const response = Object.assign(new EventEmitter(), {
    destroyed: false,
    status: jest.fn(),
    set: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
  });
  response.status.mockReturnValue(response);
  response.set.mockReturnValue(response);
  return {
    events,
    bus,
    access,
    request,
    response,
    open: () =>
      new RealtimeController(
        bus as unknown as RealtimeBus,
        access as unknown as RealtimeAccess,
      ).translations(
        request as unknown as Request,
        response as unknown as Response,
      ),
  };
}
afterEach(() => {
  jest.useRealTimers();
});

it('validates v1 resource and identity without retaining unsafe payloads', () => {
  const event = {
    ...resyncEvent(),
    type: 'updated',
    recordId: '12',
    privateRecord: { value: 'secret' },
  };
  expect(parseRealtimeEvent(JSON.stringify(event))).toEqual({
    version: 1,
    eventId: event.eventId,
    resource: 'translations',
    type: 'updated',
    recordId: '12',
    occurredAt: event.occurredAt,
  });
  for (const change of [
    { version: 2 },
    { resource: 'tracked-documents' },
    { eventId: '' },
    { type: 'updated', recordId: undefined },
    { occurredAt: 'bad' },
    { recordId: {} },
  ]) {
    expect(
      parseRealtimeEvent(JSON.stringify({ ...event, ...change })),
    ).toBeUndefined();
  }
  expect(parseRealtimeEvent('invalid')).toBeUndefined();
});

it('checks uncached Better Auth sessions and fresh CASL abilities on every call', async () => {
  const getSession = jest
    .fn<() => Promise<{ user: { id: string } } | null>>()
    .mockResolvedValue({ user: { id: '7' } });
  const can = jest.fn().mockReturnValue(true);
  const createForUser = jest
    .fn<() => Promise<{ can: typeof can }>>()
    .mockResolvedValue({ can });
  const access = new RealtimeAccess(
    { api: { getSession } } as unknown as AuthService<Auth>,
    { createForUser } as unknown as CaslAbilityFactory,
  );
  await access.assertRead({ cookie: 'cookie' });
  await access.assertRead({ authorization: 'Bearer token' });
  expect(getSession.mock.calls).toHaveLength(2);
  expect(getSession).toHaveBeenLastCalledWith(
    expect.objectContaining({ query: { disableCookieCache: true } }),
  );
  expect(createForUser).toHaveBeenCalledWith(7);
  can.mockReturnValue(false);
  await expect(access.assertRead({})).rejects.toMatchObject({ status: 403 });
  getSession.mockResolvedValue(null);
  await expect(access.assertRead({})).rejects.toMatchObject({ status: 401 });
});

it('fails closed when gated, disconnected, wrong origin or no read permission before opening SSE', async () => {
  const f = setup();
  f.bus.enabled = false;
  await expect(f.open()).rejects.toMatchObject({ status: 503 });
  f.bus.enabled = true;
  f.bus.ready = false;
  await expect(f.open()).rejects.toMatchObject({ status: 503 });
  f.bus.ready = true;
  f.request.headers.origin = 'https://untrusted.example';
  await expect(f.open()).rejects.toMatchObject({ status: 403 });
  f.request.headers.origin = 'http://localhost:8080';
  f.access.assertRead.mockRejectedValue(new Error('denied'));
  await expect(f.open()).rejects.toThrow('denied');
  expect(f.response.flushHeaders).not.toHaveBeenCalled();
});

it.each([
  { label: 'reader', action: 'read', subject: 'TranslationKey', allowed: true },
  {
    label: 'delegated manager',
    action: 'manage',
    subject: 'TranslationKey',
    allowed: true,
  },
  { label: 'administrator', action: 'manage', subject: 'all', allowed: true },
  {
    label: 'document-only handler',
    action: 'read',
    subject: 'TrackedDocument',
    allowed: false,
  },
  {
    label: 'disabled account',
    action: 'manage',
    subject: 'all',
    allowed: false,
    isEnabled: false,
  },
  {
    label: 'locked account',
    action: 'manage',
    subject: 'all',
    allowed: false,
    isLocked: true,
  },
  {
    label: 'inactive account',
    action: 'manage',
    subject: 'all',
    allowed: false,
    isActivated: false,
  },
  {
    label: 'disabled role',
    action: 'manage',
    subject: 'all',
    allowed: false,
    roleEnabled: false,
  },
])('enforces current resource read permission for $label', async (options) => {
  const user = {
    id: 7,
    isEnabled: options.isEnabled ?? true,
    isLocked: options.isLocked ?? false,
    isActivated: options.isActivated ?? true,
    userRole: {
      id: 1,
      name: options.label,
      isEnabled: options.roleEnabled ?? true,
      permissions: [
        { permission: { action: options.action, subject: options.subject } },
      ],
    },
  };
  const prisma = {
    user: {
      findUnique: jest.fn<() => Promise<typeof user>>().mockResolvedValue(user),
    },
  };
  const abilities = new CaslAbilityFactory(prisma as unknown as PrismaService);
  const auth = {
    api: {
      getSession: jest
        .fn<() => Promise<{ user: { id: string } }>>()
        .mockResolvedValue({ user: { id: '7' } }),
    },
  };
  const access = new RealtimeAccess(
    auth as unknown as AuthService<Auth>,
    abilities,
  );
  if (options.allowed)
    await expect(access.assertRead({})).resolves.toBeUndefined();
  else
    await expect(access.assertRead({})).rejects.toMatchObject({ status: 403 });
});

it('sends initial resync, rechecks before each event, and disconnects on revocation without sending it', async () => {
  const f = setup();
  await f.open();
  await flush();
  expect(f.response.write).toHaveBeenCalledTimes(1);
  expect(String(f.response.write.mock.calls[0][0])).toContain('resync');
  f.events.next(resyncEvent());
  await flush();
  expect(f.response.write).toHaveBeenCalledTimes(2);
  f.access.assertRead.mockRejectedValue(new Error('revoked'));
  f.events.next(resyncEvent());
  await flush();
  expect(f.response.write).toHaveBeenCalledTimes(2);
  expect(f.response.end).toHaveBeenCalledTimes(1);
  expect(f.events.observed).toBe(false);
});

it('detects logout/expiry on idle heartbeat and releases timers/subscription on disconnect', async () => {
  jest.useFakeTimers();
  const f = setup();
  await f.open();
  await flush();
  f.access.assertRead.mockRejectedValue(new Error('session expired'));
  jest.advanceTimersByTime(15000);
  await flush();
  expect(f.response.end).toHaveBeenCalledTimes(1);
  expect(f.events.observed).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it('closes slow clients and bounds queued authorization work', async () => {
  const f = setup();
  f.response.write.mockReturnValue(false);
  await f.open();
  await flush();
  expect(f.events.observed).toBe(false);
  const g = setup();
  await g.open();
  for (let i = 0; i < 100; i++) g.events.next(resyncEvent());
  await flush();
  expect(g.response.end).toHaveBeenCalledTimes(1);
  expect(g.events.observed).toBe(false);
});

it('closes active streams after database delivery loss; later clients must reconnect', async () => {
  const f = setup();
  await f.open();
  await flush();
  f.bus.ready = false;
  f.events.next(resyncEvent());
  await flush();
  expect(f.response.end).toHaveBeenCalledTimes(1);
  expect(f.response.write).toHaveBeenCalledTimes(1);
});

it.each(['request', 'response', 'lifetime'] as const)(
  'cleans up on %s closure',
  async (path) => {
    jest.useFakeTimers();
    const f = setup();
    await f.open();
    await flush();
    if (path === 'lifetime') jest.advanceTimersByTime(5 * 60000);
    else f[path].emit('close');
    await flush();
    expect(f.events.observed).toBe(false);
    expect(f.response.end).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  },
);
