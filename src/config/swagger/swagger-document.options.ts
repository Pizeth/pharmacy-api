// // src/config/swagger/swagger-document.options.ts

// import type { SwaggerDocumentOptions } from '@nestjs/swagger';

// import { createSchema } from 'zod-openapi';

// /**
//  * Swagger/OpenAPI configuration for Standard Schema based DTOs.
//  *
//  * Nest supplies:
//  *
//  *   schemaType = "input"
//  *
//  * or:
//  *
//  *   schemaType = "output"
//  *
//  * which matters when Zod schemas perform transformations.
//  */
// export const swaggerDocumentOptions: SwaggerDocumentOptions = {
//   standardSchemaConverter: (schema, { schemaType }) => {
//     /**
//      * This application standardizes on Zod for Standard Schema
//      * validation, so the converter can directly delegate to
//      * zod-openapi.
//      */
//     const converted = createSchema(schema as never, {
//       io: schemaType,

//       openapiVersion: '3.0.0',
//     });

//     return {
//       schema: converted.schema,

//       components: converted.components,
//     };
//   },
// };
