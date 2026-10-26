import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max).nullable();
const userId = z.number().int().positive().nullable();
export const documentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    categoryId: z.uuid(),
    typeId: z.uuid(),
    subtype: text(160),
    priority: z.enum(['NORMAL', 'URGENT']),
    incomingNumber: text(120),
    outgoingNumber: text(120),
    receivedAt: z.iso.datetime({ offset: true }),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    responsibleDepartmentId: userId,
    assignedToId: userId,
    storageLocationCode: text(100),
    chronologicalCode: text(100),
    archiveSequence: z.number().int().positive().nullable(),
    notes: text(4000),
  })
  .strict();
export const updateDocumentSchema = documentInputSchema.extend({
  version: z.number().int().positive(),
});
export const versionSchema = z
  .object({
    version: z.number().int().positive(),
    note: z.string().trim().min(1).max(4000),
  })
  .strict();
export const progressSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum([
      'FORWARD',
      'RETURN',
      'ASSIGN',
      'HOLD',
      'RESUME',
      'COMMENT',
      'CANCEL',
    ]),
    note: text(4000),
    assignedToId: userId.optional(),
    departmentId: userId.optional(),
    targetPosition: z.number().int().nonnegative().optional(),
    outgoingNumber: text(120).optional(),
    storageLocationCode: text(100).optional(),
    chronologicalCode: text(100).optional(),
    archiveSequence: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ['RETURN', 'HOLD', 'CANCEL', 'COMMENT'].includes(value.action) &&
      !value.note
    )
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'A reason or comment is required.',
      });
    if (value.action === 'RETURN' && value.targetPosition == null)
      ctx.addIssue({
        code: 'custom',
        path: ['targetPosition'],
        message: 'Choose an earlier stage.',
      });
  });
export const attachmentSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(255),
    url: z.url({ protocol: /^https?$/ }).max(2048),
    kind: z.enum(['INCOMING', 'OUTGOING', 'SUPPORTING']),
  })
  .strict();
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
