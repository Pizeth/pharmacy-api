import { z } from 'zod';

export const createSocialProviderSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_-]*$/),
  name: z.string().trim().min(1).max(100),
  websiteUrl: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .nullable()
    .optional(),
  icon: z.string().trim().min(1).max(255).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const updateSocialProviderSchema = createSocialProviderSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: 'At least one provider field is required',
    },
  );

export type CreateSocialProviderDto = z.output<
  typeof createSocialProviderSchema
>;
export type UpdateSocialProviderDto = z.output<
  typeof updateSocialProviderSchema
>;
