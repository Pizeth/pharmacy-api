// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.

export const createUserIdentitySchema = z.object({
  providerId: z.number().int().positive().meta({
    description: 'The provider id for the user identity.',
    example: 1,
  }),
  userId: z.number().int().meta({
    description: 'The user id for the user identity.',
    example: 1,
  }),
  providerUserId: z.string().trim().meta({
    description: 'The provider user id for the user identity.',
    example: '1234567890',
  }),
  isEnabled: z.boolean().default(true).optional().meta({
    description: 'Whether the user identity is enabled.',
    example: true,
  }),
  // accessToken: z.string().nullable().optional().meta({
  //   description: 'The access token for the user identity.',
  //   example: '1234567890',
  // }),
  // refreshToken: z.string().nullable().optional().meta({
  //   description: 'The refresh token for the user identity.',
  //   example: '1234567890',
  // }),
  // expiresAt: z.date().nullable().optional().meta({
  //   description: 'The expires at for the user identity.',
  //   example: '2021-01-01T00:00:00.000Z',
  // }),
});

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateIdentityDto extends createZodDto(createUserIdentitySchema) {}
