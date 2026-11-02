import { randomUUID } from 'node:crypto';

export const REALTIME_CHANNEL = 'datatable_live_v1';
export const TRANSLATIONS_RESOURCE = 'translations';
export interface RealtimeEvent {
  version: 1;
  eventId: string;
  resource: 'translations';
  type: 'created' | 'updated' | 'deleted' | 'invalidate';
  recordId?: string;
  occurredAt: string;
  reason?: 'resync';
}

export function resyncEvent(): RealtimeEvent {
  return {
    version: 1,
    eventId: randomUUID(),
    resource: TRANSLATIONS_RESOURCE,
    type: 'invalidate',
    occurredAt: new Date().toISOString(),
    reason: 'resync',
  };
}

/** Untrusted database notifications never carry arbitrary record payloads. */
export function parseRealtimeEvent(payload: string): RealtimeEvent | undefined {
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== 'object') return undefined;
    const event = value as Record<string, unknown>;
    if (
      event.version !== 1 ||
      event.resource !== TRANSLATIONS_RESOURCE ||
      typeof event.eventId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(event.eventId) ||
      typeof event.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(event.occurredAt)) ||
      !['created', 'updated', 'deleted', 'invalidate'].includes(
        String(event.type),
      ) ||
      (event.recordId !== undefined &&
        (typeof event.recordId !== 'string' ||
          !/^\d+$/.test(event.recordId))) ||
      (event.type !== 'invalidate' && event.recordId === undefined)
    )
      return undefined;
    return {
      version: 1,
      eventId: event.eventId,
      resource: TRANSLATIONS_RESOURCE,
      type: event.type as RealtimeEvent['type'],
      occurredAt: event.occurredAt,
      ...(typeof event.recordId === 'string'
        ? { recordId: event.recordId }
        : {}),
    };
  } catch {
    return undefined;
  }
}
