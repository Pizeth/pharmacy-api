// -----------------------------------------------------------------
// Create a dedicated patch file (More Robust Approach)
// Location: src/zod-patch.ts
// -----------------------------------------------------------------
// By isolating the patch into its own file, we can ensure it's imported
// and executed before anything else in our main bootstrap file.

import { patchNestJsSwagger } from 'nestjs-zod';
// import { z } from 'zod';
// import { extendZodWithOpenApi } from 'zod-openapi';

// extendZodWithOpenApi(z);

// Call the patch function immediately.
patchNestJsSwagger();
