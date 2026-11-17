import { z } from 'zod';

export const DOCUMENT_REALTIME_CHANNEL = 'document_tracking_live_v1';

const documentNotificationSchema = z.object({
  version: z.literal(1),
  eventId: z.uuid(),
  documentId: z.uuid(),
  previousAssignees: z
    .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .max(2),
  occurredAt: z.iso.datetime(),
});

export type DocumentRealtimeNotification = z.infer<
  typeof documentNotificationSchema
>;

export function parseDocumentRealtimeNotification(
  payload: string,
): DocumentRealtimeNotification | undefined {
  try {
    const result = documentNotificationSchema.safeParse(JSON.parse(payload));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
