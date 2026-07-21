import { Prisma } from 'generated/prisma/client';

// Reusable include for full user detail
export const TRANSLATION_DETAIL_INCLUDE = {
  key: true,
} satisfies Prisma.TranslationInclude;
