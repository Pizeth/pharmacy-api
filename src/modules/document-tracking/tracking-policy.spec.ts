import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  isTrackingAdmin,
  hasDocumentManagementPermission,
  planProgress,
  type TrackingActor,
  type TrackingState,
} from './tracking-policy';
import {
  progressSchema,
  attachmentSchema,
  documentInputSchema,
} from './document-tracking.schemas';
import { dataTableQuerySchema, resolveDataTableQuery } from 'common/data-table';
import {
  trackingQueryPolicy,
  trackingTranslator,
} from './document-tracking.query';
const handler: TrackingActor = { id: 2, name: 'Handler', isAdmin: false },
  admin: TrackingActor = { id: 1, name: 'Admin', isAdmin: true };
const state = (): TrackingState => ({
  version: 3,
  status: 'ACTIVE',
  archivedAt: null,
  steps: ['RECEIVED', 'PROCESSING', 'FILING'].map((key, position) => ({
    id: String(position),
    key,
    name: key,
    position,
    status:
      position === 1 ? 'ACTIVE' : position === 0 ? 'COMPLETED' : 'PENDING',
    assignedToId: position === 1 ? 2 : null,
  })),
});
const command = (
  action:
    'FORWARD' | 'RETURN' | 'ASSIGN' | 'HOLD' | 'RESUME' | 'COMMENT' | 'CANCEL',
) => ({ version: 3, action, note: 'Handling note', assignedToId: 3 });
it.each(['SYS_ADMIN', 'SUPER_ADMIN', 'admin', 'user,super-admin'])(
  'recognizes admin role %s',
  (role) => expect(isTrackingAdmin([role])).toBe(true),
);
it('does not mistake a similarly named role for an admin', () =>
  expect(isTrackingAdmin(['not-admin', 'administrator', 'user'])).toBe(false));
it('permits the assigned handler to hand off only to the next stage', () =>
  expect(planProgress(state(), command('FORWARD'), handler)).toMatchObject({
    kind: 'FORWARDED',
    target: { position: 2 },
    status: 'ACTIVE',
  }));
it('rejects a non-current handler even if they know the id', () =>
  expect(() =>
    planProgress(state(), command('FORWARD'), { ...handler, id: 99 }),
  ).toThrow(ForbiddenException));
it('rejects a stale version before any progress is planned', () =>
  expect(() =>
    planProgress(state(), { ...command('FORWARD'), version: 2 }, admin),
  ).toThrow(ConflictException));
it('rejects changes to archived records', () =>
  expect(() =>
    planProgress(
      { ...state(), archivedAt: new Date() },
      command('FORWARD'),
      admin,
    ),
  ).toThrow(ConflictException));
it('requires a receiving handler for handoffs', () =>
  expect(() =>
    planProgress(state(), { ...command('FORWARD'), assignedToId: null }, admin),
  ).toThrow(BadRequestException));
it('supports a return for rework to an earlier stage', () =>
  expect(
    planProgress(state(), { ...command('RETURN'), targetPosition: 0 }, handler),
  ).toMatchObject({ kind: 'RETURNED', target: { position: 0 } }));
it.each([1, 2, 9])(
  'rejects return to current/future/missing stage %s',
  (targetPosition) =>
    expect(() =>
      planProgress(state(), { ...command('RETURN'), targetPosition }, admin),
    ).toThrow(BadRequestException),
);
it('requires resume before a held document can move', () =>
  expect(() =>
    planProgress(
      { ...state(), status: 'ON_HOLD' },
      command('FORWARD'),
      handler,
    ),
  ).toThrow(ConflictException));
it('retains hold when assigning a new handler', () =>
  expect(
    planProgress({ ...state(), status: 'ON_HOLD' }, command('ASSIGN'), handler)
      .status,
  ).toBe('ON_HOLD'));
it('resumes a held document', () =>
  expect(
    planProgress({ ...state(), status: 'ON_HOLD' }, command('RESUME'), handler)
      .status,
  ).toBe('ACTIVE'));
it('does not resume an active document', () =>
  expect(() => planProgress(state(), command('RESUME'), handler)).toThrow(
    ConflictException,
  ));
it('only an admin may cancel', () => {
  expect(() => planProgress(state(), command('CANCEL'), handler)).toThrow(
    ForbiddenException,
  );
  expect(planProgress(state(), command('CANCEL'), admin).status).toBe(
    'CANCELLED',
  );
});
it('cancelled records cannot move', () =>
  expect(() =>
    planProgress(
      { ...state(), status: 'CANCELLED' },
      command('FORWARD'),
      admin,
    ),
  ).toThrow(ConflictException));
it('completes at the final stage', () => {
  const doc = state();
  doc.steps = doc.steps.map((s) => ({
    ...s,
    status: s.position === 2 ? 'ACTIVE' : 'COMPLETED',
    assignedToId: 2,
  }));
  expect(planProgress(doc, command('FORWARD'), handler)).toMatchObject({
    kind: 'COMPLETED',
    status: 'COMPLETED',
  });
});
it('only admins can reopen completed records', () => {
  const doc = {
    ...state(),
    status: 'COMPLETED' as const,
    steps: state().steps.map((s) => ({
      ...s,
      status: 'COMPLETED' as const,
      assignedToId: 2,
    })),
  };
  expect(() =>
    planProgress(doc, { ...command('RETURN'), targetPosition: 0 }, handler),
  ).toThrow(ForbiddenException);
  expect(
    planProgress(doc, { ...command('RETURN'), targetPosition: 0 }, admin)
      .status,
  ).toBe('ACTIVE');
});
it.each(['RETURN', 'HOLD', 'CANCEL', 'COMMENT'])(
  'requires a reason/comment for %s',
  (action) =>
    expect(
      progressSchema.safeParse({
        version: 1,
        action,
        note: ' ',
        targetPosition: 0,
      }).success,
    ).toBe(false),
);
it('rejects arbitrary fields and unsafe attachment schemes', () => {
  expect(
    progressSchema.safeParse({ ...command('FORWARD'), isAdmin: true }).success,
  ).toBe(false);
  expect(
    attachmentSchema.safeParse({
      version: 1,
      name: 'File',
      url: 'javascript:alert(1)',
      kind: 'INCOMING',
    }).success,
  ).toBe(false);
  expect(
    documentInputSchema.safeParse({ title: 'Missing fields' }).success,
  ).toBe(false);
});
it('translates the handler filter to the current assignment only', () => {
  const resolved = resolveDataTableQuery(
    trackingQueryPolicy,
    dataTableQuerySchema.parse({
      filters: [{ field: 'assignedToId', operator: 'equals', value: 2 }],
    }),
  );
  expect(
    JSON.stringify(trackingTranslator.translate(resolved).where),
  ).toContain('ACTIVE');
});
it.each([
  { field: 'assignedToId', operator: 'equals', value: '2' },
  { field: 'categoryId', operator: 'equals', value: 'bad' },
  { field: 'status', operator: 'equals', value: 'unknown' },
  { field: 'actorId', operator: 'equals', value: 1 },
])('rejects unsupported or malformed filters %j', (filter) =>
  expect(() =>
    resolveDataTableQuery(
      trackingQueryPolicy,
      dataTableQuerySchema.parse({ filters: [filter] }),
    ),
  ).toThrow(),
);

it('accepts only the explicit tracked-document management grant', () => {
  expect(
    hasDocumentManagementPermission([
      { action: 'manage', subject: 'TrackedDocument' },
    ]),
  ).toBe(true);
  expect(
    hasDocumentManagementPermission([
      { action: 'read', subject: 'TrackedDocument' },
    ]),
  ).toBe(false);
  expect(
    hasDocumentManagementPermission([
      { action: 'manage', subject: 'TranslationKey' },
    ]),
  ).toBe(false);
  expect(hasDocumentManagementPermission([])).toBe(false);
});

it('keeps delegated management separate from administrator progress overrides', () => {
  const manager = { ...handler, isAdmin: true, isTrackingAdmin: false };
  expect(() =>
    planProgress(state(), command('COMMENT'), { ...manager, id: 99 }),
  ).toThrow(ForbiddenException);
  expect(() => planProgress(state(), command('CANCEL'), manager)).toThrow(
    ForbiddenException,
  );
  expect(() =>
    planProgress(
      { ...state(), status: 'COMPLETED' },
      command('COMMENT'),
      manager,
    ),
  ).toThrow(ForbiddenException);
  expect(planProgress(state(), command('COMMENT'), manager)).toMatchObject({
    kind: 'COMMENTED',
  });
});
