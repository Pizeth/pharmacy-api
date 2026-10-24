// -----------------------------------------------------------------
// Define the schema and infer the native NestJS request type from Zod
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const signInSchema = z.object({
  officialId: z
    .string()
    .trim()
    .length(10, 'Official ID must be 10 characters')
    .meta({
      description: 'The public officialId for the user.',
      example: '1234567890',
    }),
  password: z.string().trim().meta({
    description: 'User password',
    example: 'S3cureP@ssword!',
    format: 'password', // This will hide the value in Swagger UI
  }),
});

export type SignInDto = z.output<typeof signInSchema>;
