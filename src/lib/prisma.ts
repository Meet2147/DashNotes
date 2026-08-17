import { PrismaClient } from '@prisma/client';
import { normalizeDatabaseUrl } from './databaseUrl';

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
