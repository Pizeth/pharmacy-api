import { z } from 'zod';

export const createSocialProfileSchema = z.object({
  providerId: z.number().int().positive(),
  handle: z.string().trim().min(1).max(255),
  url: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .nullable()
    .optional(),
});

export const updateSocialProfileSchema = createSocialProfileSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: 'At least one profile field is required',
    },
  );

export type CreateSocialProfileDto = z.output<typeof createSocialProfileSchema>;
export type UpdateSocialProfileDto = z.output<typeof updateSocialProfileSchema>;
