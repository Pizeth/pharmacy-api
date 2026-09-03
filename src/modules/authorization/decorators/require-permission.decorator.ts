// src/modules/authorization/decorators/require-permission.decorator.ts

import { applyDecorators, UseGuards } from '@nestjs/common';
import type { AppAction, AppSubject } from '../casl/app-ability';
import { PoliciesGuard } from '../guards/policies.guard';
import { CheckPolicies } from './check-policies.decorator';

/**
 * Declarative authorization shortcut for simple action/subject rules.
 *
 * Example:
 *
 * @RequirePermission(
 *   AppAction.Read,
 *   AppSubject.TranslationKey,
 * )
 */
export function RequirePermission(
  action: AppAction,
  subject: AppSubject,
): MethodDecorator {
  return applyDecorators(
    UseGuards(PoliciesGuard),
    CheckPolicies((ability) => ability.can(action, subject)),
  );
}
