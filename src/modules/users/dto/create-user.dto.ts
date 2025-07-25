// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const usernameRegex = /^(?=.{5,50}$)[a-zA-Z](?!.*([_.])\1)[a-zA-Z0-9_.]*$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const createUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(5, { error: 'Username must be at least 5 characters' })
      .max(50, 'Username must be at most 50 characters')
      .refine((username) => usernameRegex.test(username), {
        message:
          'Username must be at least 5 characters, start with a letter, and can contain letters, numbers, underscore, and dot!',
      })
      .meta({
        description: 'The public username for the user.',
        example: 'john_doe',
      }),
    email: z.email('Invalid email address.').meta({
      description: 'The unique email address for the user.',
      example: 'john.doe@example.com',
    }),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters long.')
      .refine((password) => passwordRegex.test(password), {
        message:
          'Password must be at least 10 characters, including uppercase, lowercase, number, and special character!',
      })
      .meta({
        description:
          'User password (at least 10 characters, including uppercase, lowercase, number, and special character.).',
        example: 'S3cureP@ssword!',
        format: 'password', // This will hide the value in Swagger UI
      }),
    repassword: z
      .string()
      .min(10, 'Password must be at least 10 characters long.'),
    avatar: z.string().nullable().optional(),
    roleId: z.coerce
      .number({
        error: (issue) =>
          issue.input === undefined
            ? 'This field is required'
            : 'roleId must be a number',
      })
      .int()
      .positive('roleId must be a positive integer.')
      .meta({
        description: 'The ID of the role assigned to the user.',
        example: 1,
      }),
    createdBy: z.coerce.number().int(),
    lastUpdatedBy: z.coerce.number().int(),
    objectVersionId: z.coerce.number().int().default(1),
  })
  // Add an object-level refinement to compare password and repassword.
  .refine((data) => data.password === data.repassword, {
    // This message will be displayed if the validation fails.
    message: 'Passwords do not match',
    // The `path` specifies which field the error should be attached to.
    path: ['repassword'],
  });

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateUserDto extends createZodDto(createUserSchema) {}
