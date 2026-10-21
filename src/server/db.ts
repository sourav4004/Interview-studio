/**
 * Server-only Prisma Client Singleton.
 *
 * Configured for Neon PostgreSQL with pooled connection strings for application queries
 * and direct connection strings for migrations.
 *
 * References:
 * - ARCHITECTURE.md (Section 5: Database and state)
 * - DECISIONS.md (Neon PostgreSQL and Prisma)
 */

import { PrismaClient } from "@prisma/client";

// Prevent accidental client-side bundle leakage
if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Prisma client cannot be imported into client-side code."
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Creates a configured PrismaClient instance.
 * In development, query and warning logs are enabled for observability.
 * In production, only errors and minimal diagnostics are emitted.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Preserve singleton across Next.js hot module reloads in non-production environments
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
