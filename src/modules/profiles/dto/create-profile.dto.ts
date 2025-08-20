// -----------------------------------------------------------------
// Define your DTO using Zod and `createZodDto`
// Location: src/users/dto/create-user.dto.ts
// -----------------------------------------------------------------
import { createZodDto } from 'nestjs-zod';
import { Sex } from 'src/types/commons.enum';
import { z } from 'zod';

// Define Zod schema the validation schema
// You can add .openapi() to provide Swagger-specific metadata.
export const createProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .max(50, 'Firstname must be at most 50 characters')
    .meta({
      description: 'The first name of the user.',
      example: 'John',
    }),
  lastName: z
    .string()
    .trim()
    .max(50, 'Lastname must be at most 50 characters')
    .meta({
      description: 'The last name of the user.',
      example: 'Doe',
    }),
  sex: z.enum(Sex).meta({
    description: 'The sex of the user.',
    example: 'MALE',
  }),
  dob: z.coerce.date().meta({
    description: 'The date of birth of the user.',
    example: '1990-01-01',
  }),
  pob: z
    .string()
    .max(50, 'Place of Birth must be at most 50 characters')
    .trim()
    .nullable()
    .optional()
    .meta({
      description: 'The place of birth of the user.',
      example: 'New York',
    }),
  address: z
    .string()
    .max(255, 'Address must be at most 255 characters')
    .trim()
    .nullable()
    .optional()
    .meta({
      description: 'The address of the user.',
      example: '123 Main St',
    }),
  phone: z
    .string()
    .max(255, 'Phone number must be at most 255 characters')
    .trim()
    .nullable()
    .optional()
    .meta({
      description: 'The phone number of the user.',
      example: '123-456-7890',
    }),
  married: z.boolean().default(false).meta({
    description: 'Marital status of the user.',
    example: true,
  }),
  bio: z
    .string()
    .max(255, 'Bio must be at most 255 characters')
    .trim()
    .nullable()
    .optional()
    .meta({
      description: 'A short biography of the user.',
      example: 'I am a software engineer.',
    }),
  userId: z.coerce.number().int(),
  isEnabled: z.boolean().default(true),
  isHold: z.boolean().default(false),
  createdBy: z.coerce.number().int(),
  lastUpdatedBy: z.coerce.number().int(),
  objectVersionId: z.coerce.number().int().default(1),
});

// **THE MAGIC STEP**: Generate a DTO class from the schema.
// This class can be used by NestJS for type hinting and by @nestjs/swagger for documentation.
export class CreateProfileDto extends createZodDto(createProfileSchema) {}
