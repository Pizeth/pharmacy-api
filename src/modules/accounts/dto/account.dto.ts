// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { createZodDto } from 'nestjs-zod';
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

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class SignInDto extends createZodDto(signInSchema) {}
