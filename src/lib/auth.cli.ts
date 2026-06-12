import { betterAuth } from 'better-auth';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { options } from './auth';

// Standalone instance for CLI use only — no NestJS DI involved
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  ...options(prisma),
});
