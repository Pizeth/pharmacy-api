// -----------------------------------------------------------------
// DTO and Zod Schema for Query Options
// Location: src/modules/images/dto/image-options.dto.ts
// -----------------------------------------------------------------
// This DTO validates all the optional query parameters you can pass to the API.

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const imageOptionsSchema = z
  .object({
    // General options
    flip: z.coerce.boolean().optional(),
    rotate: z.coerce.number().int().min(0).max(360).optional(),
    scale: z.coerce.number().int().min(0).max(200).optional(),
    radius: z.coerce.number().int().min(0).max(50).optional(),
    // Size is limited to 256 for raster formats as per DiceBear API docs.
    size: z.coerce.number().int().min(32).max(256).optional(),
    backgroundColor: z
      .string()
      .regex(/^[a-fA-F0-9]{3,8}$/)
      .optional(),
    backgroundType: z.enum(['solid', 'gradientLinear', 'random']).optional(),
    backgroundRotation: z.coerce.number().int().min(0).max(360).optional(),

    // Font options specifically for the 'initials' style
    fontFamily: z.string().optional(),
    fontSize: z.coerce.number().int().min(1).max(100).optional(),
    fontWeight: z.coerce.number().int().min(100).max(900).optional(),
    bold: z.coerce.boolean().optional(),

    // Add style-specific options here if needed
    // For example, for the 'adventurer' style:
    // "hair": ["long01", "long02"], "eyes": ["variant01"], etc.
    // This can be done with a catchall or by extending the object.
    // For simplicity, we'll use a catchall for any other string options.
  })
  .catchall(
    z.string().transform((val) => {
      // DiceBear options are often arrays passed as comma-separated strings
      if (val.includes(',')) return val.split(',');
      return val;
    }),
  );

export class ImageOptionsDto extends createZodDto(imageOptionsSchema) {}
