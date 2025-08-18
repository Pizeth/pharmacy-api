// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const createUserSchema = z.object({
  name: z.string().trim().meta({
    description: 'The provider name for the identity provider.',
    example: 'google, microsoft, facebook...etc',
  }),
  displayName: z.string().trim().meta({
    description: 'The display name identity provider.',
    example: 'Google, Microsoft, Apple...etc',
  }),
  issuer: z.string().trim().meta({
    description: 'The issuer for the identity provider.',
    example: 'https://accounts.google.com',
  }),
  authorizationURL: z.string().trim().meta({
    description: 'The authorization URL for the identity provider.',
    example: 'https://accounts.google.com/o/oauth2/v2/auth',
  }),
  tokenURL: z.string().trim().meta({
    description: 'The token URL for the identity provider.',
    example: 'https://oauth2.googleapis.com/token',
  }),
  callbackURL: z.string().trim().meta({
    description: 'The callback URL for the identity provider.',
    example: 'http://localhost:3000/auth/google/callback',
  }),
  userInfoURL: z.string().trim().meta({
    description: 'The user info URL for the identity provider.',
    example: 'https://openidconnect.googleapis.com/v1/userinfo',
  }),
  clientID: z.string().trim().meta({
    description: 'The client ID for the identity provider.',
    example: 'GOOGLE_CLIENT_ID',
  }),
  clientSecret: z.string().trim().meta({
    description: 'The client secret for the identity provider.',
    example: 'GOOGLE_CLIENT_SECRET',
  }),
  //   claims: z
  //     .preprocess(
  //       (value: unknown) =>
  //         typeof value === 'string' ? JSON.parse(value) : value,
  //       z.object({}).array(),
  //     )
  //     .nullable()
  //     .optional()
  //     .meta({
  //       description: 'The claims for the identity provider.',
  //       example: 'openid email profile',
  //     }),
  loginHint: z.string().trim().nullable().optional().meta({
    description: 'The login hint for the identity provider.',
    example: 'john_doe',
  }),
  maxAge: z.coerce
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'No maxAge provided'
          : 'maxAge must be a number',
    })
    .int()
    .positive('maxAge must be a positive integer.')
    .nullable()
    .optional()
    .meta({
      description: 'The max age for the identity provider.',
      example: 3600,
    }),
  nonce: z.string().trim().nullable().optional().meta({
    description: 'The nonce for the identity provider.',
    example: '1234567890',
  }),
  responseMode: z.string().trim().nullable().optional().meta({
    description: 'The response mode for the identity provider.',
    example: 'query',
  }),
  prompt: z.string().trim().nullable().optional().meta({
    description: 'The prompt for the identity provider.',
    example: 'consent',
  }),
  scope: z.string().trim().meta({
    description: 'The scope for the identity provider.',
    example: 'openid email profile',
  }),
  uniLocale: z.string().trim().nullable().optional().meta({
    description: 'The universal locale for the identity provider.',
    example: 'en',
  }),
  enabled: z.boolean().default(true).meta({
    description: 'The enable for the identity provider.',
    example: true,
  }),
});

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateProviderDto extends createZodDto(createUserSchema) {}
