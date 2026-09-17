import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * One PrismaClient for the process. nodemon restarts would otherwise leak a
 * connection pool per reload until Postgres refuses new connections.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv !== 'production') globalForPrisma.__prisma = prisma;

/** Used by /api/health so C can see at a glance whether the DB is up. */
export async function dbStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'up';
  } catch {
    return 'down';
  }
}

/**
 * Prisma returns BigInt for our hash columns, and JSON.stringify refuses to
 * serialise BigInt. Convert at the boundary rather than teaching every route.
 */
export const bigIntToString = (v) => (typeof v === 'bigint' ? v.toString() : v);
