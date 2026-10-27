import { z } from 'zod';
export const ROLE_ICONS = [
  'shield',
  'shield-check',
  'user',
  'user-round',
  'crown',
  'settings',
  'users',
  'lock',
  'badge-check',
] as const;
export const roleInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .transform((value) => value.toUpperCase().replaceAll('-', '_')),
    description: z.string().trim().max(255).nullable(),
    icon: z.enum(ROLE_ICONS).nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable(),
    isEnabled: z.boolean(),
    permissionIds: z
      .array(z.number().int().positive())
      .max(1000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Choose each permission only once.',
      ),
  })
  .strict();
export const roleUpdateSchema = roleInputSchema.extend({
  version: z.number().int().positive(),
});
export const roleDeleteSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;
export const protectedRole = (name: string) =>
  ['SUPER_ADMIN', 'SYS_ADMIN', 'SYSTEM_ADMIN'].includes(
    name.trim().toUpperCase().replaceAll('-', '_'),
  );
