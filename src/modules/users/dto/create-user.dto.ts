// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
// import { AuthMethod } from 'generated/prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const usernameRegex = /^(?=.{5,50}$)[a-zA-Z](?!.*([_.])\1)[a-zA-Z0-9_.]*$/;
// const passwordRegex =
//   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const createUserSchema = z.object({
  // Better Auth core fields
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .meta({
      description: 'Display name for the user.',
      example: 'John Doe',
    }),
  email: z.email('Invalid email address.').meta({
    description: 'The unique email address for the user.',
    example: 'john.doe@example.com',
  }),
  image: z.string().nullable().optional(),
  // username plugin fields
  username: z
    .string()
    .trim()
    .min(3, { error: 'Username must be at least 3 characters' })
    .max(50, 'Username must be at most 50 characters')
    .refine((username) => usernameRegex.test(username), {
      message:
        'Username must be at least 3 characters, start with a letter, and can contain letters, numbers, underscore, and dot!',
    })
    .optional()
    .meta({
      description: 'The public username for the user.',
      example: 'john_doe',
    }),
  // password: z
  //   .string()
  //   .min(10, 'Password must be at least 10 characters long.')
  //   .optional()
  //   .meta({
  //     description:
  //       'User password (at least 10 characters, including uppercase, lowercase, number, and special character.).',
  //     example: 'S3cureP@ssword!',
  //     format: 'password',
  //   }),
  // repassword: z
  //   .string()
  //   .min(10, 'Password must be at least 10 characters long.')
  //   .optional()
  //   .meta({
  //     description:
  //       'User re password (at least 10 characters, including uppercase, lowercase, number, and special character.).',
  //     example: 'S3cureR3P@ssword!',
  //     format: 'password',
  //   }),

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
  // authMethod: z
  //   .enum(AuthMethod)
  //   .default(AuthMethod.PASSWORD)
  //   .optional()
  //   .meta({
  //     description: 'The authentication method used by the user.',
  //     example: AuthMethod,
  //   }),
  // authMethod: z
  //   .array(z.enum(AuthMethod)) // Expect an array of AuthMethod enums
  //   .nonempty({ message: 'At least one auth method is required.' }) // Good practice
  //   .default([AuthMethod.PASSWORD])
  //   .optional()
  //   .meta({
  //     description: 'The authentication methods used by the user.',
  //     example: [AuthMethod.PASSWORD, AuthMethod.OIDC],
  //   }),
  // Multi-Factor Authentication
  // mfaSecret: z.string().nullable().optional(),
  // mfaEnabled: z.coerce.boolean().default(false).optional(),
  // Authentication tracking
  // loginAttempts: z.coerce.number().int().default(0).optional(),
  // lastLogin: z.coerce.date().nullable().optional(),
  // Security Flags
  // isBan: z.boolean().default(false).optional(),
  // Security flags
  isEnabled: z.boolean().default(true).optional(),
  isLocked: z.boolean().default(false).optional(),
  // isVerified: z.boolean().default(false).optional(),
  isActivated: z.boolean().default(false).optional(),
  // admin() plugin fields
  banned: z.boolean().default(false).optional(),
  banReason: z.string().nullable().optional(),
  // Audit and Tracking
  createdBy: z.coerce.number().int().optional(),
  updatedBy: z.coerce.number().int().optional(),
  objectVersionId: z.coerce.number().int().default(1).optional(),
});
// --- Use superRefine for conditional logic ---
// .superRefine((data, ctx) => {
//   // If the auth method is PASSWORD, we must validate the password fields.
//   // if (data.authMethod === 'PASSWORD') {
//   if (data.authMethod?.includes('PASSWORD')) {
//     if (!data.password) {
//       ctx.addIssue({
//         code: 'custom',
//         message: 'Password is required.',
//         path: ['password'],
//       });
//     } else {
//       // Only check regex if password exists
//       if (!passwordRegex.test(data.password)) {
//         ctx.addIssue({
//           code: 'custom',
//           message:
//             'Password must be at least 10 characters, including uppercase, lowercase, number, and special character!',
//           path: ['password'],
//         });
//       }
//     }

//     if (!data.repassword) {
//       ctx.addIssue({
//         code: 'custom',
//         message: 'Password confirmation is required.',
//         path: ['repassword'],
//       });
//     }

//     // If both passwords are provided, check if they match.
//     if (
//       data.password &&
//       data.repassword &&
//       data.password !== data.repassword
//     ) {
//       ctx.addIssue({
//         code: 'custom',
//         message: 'Passwords do not match',
//         path: ['repassword'],
//       });
//     }
//   }
// });
// // Add an object-level refinement to compare password and repassword.
// .refine((data) => data.password === data.repassword, {
//   // This message will be displayed if the validation fails.
//   message: 'Passwords do not match',
//   // The `path` specifies which field the error should be attached to.
//   path: ['repassword'],
// });

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateUserDto extends createZodDto(createUserSchema) {}
