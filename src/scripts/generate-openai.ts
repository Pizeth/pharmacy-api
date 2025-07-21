// // scripts/generate-openapi.ts
// import { writeFile, writeFileSync } from 'fs';
// import { join } from 'path';
// import { createUserSchema } from 'src/modules/users/dto/create-user.dto';
// import { createDocument } from 'zod-openapi';
// // import {
// //   createUserSchema,
// //   updateUserSchema,
// //   paginationParams,
// // } from '../src/schemas';

// async function main() {
//   const doc = createDocument({
//     openapi: '3.1.0',
//     info: {
//       title: 'Chesda Pharmacy API',
//       version: '1.0.0',
//       description: 'Automatically generated from Zod schemas',
//     },
//     paths: {
//       '/api/users': {
//         post: {
//           summary: 'Create a user',
//           requestBody: {
//             required: true,
//             content: {
//               'multipart/form-data': {
//                 schema: createUserSchema,
//                 encoding: { avatar: { contentType: 'multipart/form-data' } },
//               },
//             },
//           },
//           responses: {
//             '201': { description: 'User created' },
//           },
//         },
//       },
//       // …add more routes here…
//     },
//     components: {
//       schemas: {
//         CreateUser: createUserSchema,
//         // UpdateUser: updateUserSchema,
//         // Pagination: paginationParams,
//       },
//     },
//   });

//   writeFile(join(__dirname, '../openapi.json'), JSON.stringify(doc, null, 2));
//   console.log('✅ openapi.json generated');
// }

// main().catch((e: Error) => {
//   console.error(e);
//   process.exit(1);
// });
