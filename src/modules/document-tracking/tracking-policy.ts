import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ProgressInput } from './document-tracking.schemas';
export interface TrackingActor {
  id: number;
  name: string;
  /** Document-management access, including delegated role grants. */
  isAdmin: boolean;
  /** Actual administrator authority for progress overrides. */
  isTrackingAdmin?: boolean;
}
export interface TrackingStep {
  id: string;
  key: string;
  name: string;
  position: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  assignedToId: number | null;
}
export interface TrackingState {
  version: number;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  archivedAt: Date | null;
  steps: readonly TrackingStep[];
}
export function isTrackingAdmin(roles: readonly (string | null | undefined)[]) {
  return roles
    .flatMap((role) => (role ?? '').toLowerCase().split(','))
    .some((role) =>
      ['admin', 'sys-admin', 'super-admin', 'superadmin'].includes(
        role.trim().replace(/_/g, '-'),
      ),
    );
}
export function planProgress(
  document: TrackingState,
  input: ProgressInput,
  actor: TrackingActor,
) {
  if (document.archivedAt)
    throw new ConflictException('This record is archived.');
  if (input.version !== document.version)
    throw new ConflictException(
      'This document changed. Close this form and reload the latest record.',
    );
  const steps = [...document.steps].sort((a, b) => a.position - b.position);
  const current =
    steps.find((step) => step.status === 'ACTIVE') ?? steps.at(-1);
  if (!current) throw new ConflictException('Document route is missing.');
  const trackingAdmin = actor.isTrackingAdmin ?? actor.isAdmin;
  if (!trackingAdmin && current.assignedToId !== actor.id)
    throw new ForbiddenException(
      'Only an administrator or the currently assigned handler may update progress.',
    );
  if (!trackingAdmin && document.status === 'COMPLETED')
    throw new ForbiddenException(
      'Only an administrator may reopen a completed document.',
    );
  if (document.status === 'CANCELLED')
    throw new ConflictException(
      'Cancelled documents retain their history and cannot progress.',
    );
  if (input.action === 'CANCEL' && !trackingAdmin)
    throw new ForbiddenException('Only administrators may cancel documents.');
  if (
    document.status === 'COMPLETED' &&
    !['RETURN', 'COMMENT'].includes(input.action)
  )
    throw new ConflictException(
      'Return a completed document to an earlier stage to reopen it.',
    );
  if (
    document.status === 'ON_HOLD' &&
    !['RESUME', 'COMMENT', 'ASSIGN', 'CANCEL'].includes(input.action)
  )
    throw new ConflictException('Resume the document before moving it.');
  if (input.action === 'HOLD' && document.status !== 'ACTIVE')
    throw new ConflictException('Only active documents may be put on hold.');
  if (input.action === 'RESUME' && document.status !== 'ON_HOLD')
    throw new ConflictException('This document is not on hold.');
  if (input.action === 'ASSIGN' && !input.assignedToId)
    throw new BadRequestException('Choose a handler.');
  let target: TrackingStep | undefined;
  if (input.action === 'FORWARD')
    target = steps.find((step) => step.position === current.position + 1);
  if (input.action === 'RETURN') {
    target = steps.find((step) => step.position === input.targetPosition);
    if (!target || target.position >= current.position)
      throw new BadRequestException('Choose an earlier stage.');
  }
  if (
    (input.action === 'RETURN' || (input.action === 'FORWARD' && target)) &&
    !input.assignedToId
  )
    throw new BadRequestException('Choose the next receiving handler.');
  const kind =
    input.action === 'FORWARD'
      ? target
        ? 'FORWARDED'
        : 'COMPLETED'
      : (
          {
            RETURN: 'RETURNED',
            ASSIGN: 'ASSIGNED',
            HOLD: 'HELD',
            RESUME: 'RESUMED',
            COMMENT: 'COMMENTED',
            CANCEL: 'CANCELLED',
          } as const
        )[input.action];
  const status =
    input.action === 'HOLD'
      ? 'ON_HOLD'
      : input.action === 'CANCEL'
        ? 'CANCELLED'
        : input.action === 'RESUME' || input.action === 'RETURN'
          ? 'ACTIVE'
          : kind === 'COMPLETED'
            ? 'COMPLETED'
            : document.status;
  return { current, target, kind, status } as const;
}

/** Only the explicit full-management grant is offered for document tracking. */
export function hasDocumentManagementPermission(
  permissions: readonly { action: string; subject: string }[],
) {
  return permissions.some(
    (permission) =>
      permission.action === 'manage' &&
      permission.subject === 'TrackedDocument',
  );
}
