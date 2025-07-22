// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { createZodDto } from 'nestjs-zod';
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

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class SignInDto extends createZodDto(signInSchema) {}
