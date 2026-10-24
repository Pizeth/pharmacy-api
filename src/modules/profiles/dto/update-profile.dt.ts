import { z } from 'zod';
import { createProfileSchema } from './create-profile.dto';

export const updateProfileSchema = createProfileSchema.partial();

export type UpdateProfileDto = z.output<typeof updateProfileSchema>;
