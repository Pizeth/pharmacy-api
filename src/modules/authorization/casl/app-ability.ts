// src/modules/authorization/casl/app-ability.ts

import type { MongoAbility } from '@casl/ability';
import { z } from 'zod';

/**
 * ------------------------------------------------------------------
 * Application actions
 * ------------------------------------------------------------------
 *
 * `manage` is CASL's special action representing every action.
 */
export const APP_ACTIONS = [
  'manage',
  'create',
  'read',
  'update',
  'delete',
] as const;

export const appActionSchema = z.enum(APP_ACTIONS);

export type AppAction = z.output<typeof appActionSchema>;

/**
 * Convenient runtime constants.
 *
 * This gives us:
 *
 *   AppAction.Read
 *
 * instead of repeating arbitrary string literals throughout
 * controllers and policies.
 */
export const AppAction = {
  Manage: 'manage',
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
} as const satisfies Record<string, AppAction>;

/**
 * ------------------------------------------------------------------
 * Application subjects
 * ------------------------------------------------------------------
 *
 * Start with resources that actually exist in the application.
 *
 * Add new entries here as resource become authorization-aware.
 *
 * `all` is CASL's special subject used together with `manage`.
 */
export const APP_SUBJECTS = [
  'all',

  'TranslationKey',
  'Translation',
  'TranslationCategory',

  'User',
  'Profile',

  'Role',
  'Permission',
] as const;

export const appSubjectSchema = z.enum(APP_SUBJECTS);

export type AppSubject = z.output<typeof appSubjectSchema>;

export const AppSubject = {
  All: 'all',
  TranslationKey: 'TranslationKey',
  Translation: 'Translation',
  TranslationCategory: 'TranslationCategory',
  User: 'User',
  Profile: 'Profile',
  Role: 'Role',
  Permission: 'Permission',
} as const satisfies Record<string, AppSubject>;

/**
 * Strongly typed application-wide CASL Ability.
 *
 * This is substantially safer than:
 *
 *   type AppAbility = MongoAbility;
 *
 * which discarded action/subject type safety.
 */
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;
