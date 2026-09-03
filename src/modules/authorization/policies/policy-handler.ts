// src/modules/authorization/policies/policy-handler.ts

import type { AppAbility } from '../casl/app-ability';

/**
 * Object-oriented policy handler.
 *
 * Useful later when individual policies become substantial.
 */
export interface PolicyHandler {
  handle(ability: AppAbility): boolean;
}

/**
 * Lightweight inline policy.
 *
 * Example:
 *
 * ability =>
 *   ability.can(
 *     AppAction.Read,
 *     AppSubject.TranslationKey,
 *   )
 */
export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type AppPolicyHandler = PolicyHandler | PolicyHandlerCallback;
