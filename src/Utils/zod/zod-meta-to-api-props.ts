// // src/utils/zod-meta-to-api-props.ts
// import { z } from 'zod';
// import { ApiPropertyOptions } from '@nestjs/swagger';

// export function zodMetaToApiProps(schema: z.ZodTypeAny): ApiPropertyOptions {
//   // Access the _def property safely, as it's part of Zod's internal structure
//   // for schema definitions. The 'metadata' property is custom added via .meta().
//   const meta = (schema as z.ZodAny)._def?.metadata as
//     | Record<string, unknown>
//     | undefined;
//   if (!meta) return {};
//   const { description, example, format, deprecated } = meta;
//   return { description, example, format, deprecated };
// }
