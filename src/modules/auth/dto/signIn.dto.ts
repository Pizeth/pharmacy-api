// -----------------------------------------------------------------
// Define the schema and infer the native NestJS request type from Zod
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .min(5, 'Username must be at least 5 characters')
    .max(50, 'Username must be at most 50 characters')
    .meta({
      description: 'The public username for the user.',
      example: 'john_doe',
    }),
  password: z.string().trim().meta({
    description: 'User password',
    example: 'S3cureP@ssword!',
    format: 'password', // This will hide the value in Swagger UI
  }),
});

/**
 * Native NestJS 12 uses the schema on @Body({ schema }) and the inferred
 * Zod output type for the handler parameter.
 */
export type SignInDto = z.output<typeof signInSchema>;
