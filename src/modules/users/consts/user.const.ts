import { Prisma } from 'generated/prisma/client';

// Reusable include for full user detail
export const USER_DETAIL_INCLUDE = {
  userRole: {
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  },
  profile: true,
  socialProfiles: { include: { provider: true }, orderBy: { id: 'asc' } },
  auditTrail: true,
  accounts: true, // replaces identities — Better Auth's Account table
} satisfies Prisma.UserInclude;
