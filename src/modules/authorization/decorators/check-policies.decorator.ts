// src/modules/authorization/decorators/check-policies.decorator.ts

import { SetMetadata } from '@nestjs/common';
import type { AppPolicyHandler } from '../policies/policy-handler';

/**
 * Metadata key consumed exclusively by PoliciesGuard.
 */
export const CHECK_POLICIES_KEY = Symbol('check-policies');

/**
 * Attach one or more CASL authorization policies to a route.
 *
 * Every policy must succeed.
 */
export function CheckPolicies(
  ...handlers: readonly AppPolicyHandler[]
): MethodDecorator & ClassDecorator {
  return SetMetadata(CHECK_POLICIES_KEY, handlers);
}
