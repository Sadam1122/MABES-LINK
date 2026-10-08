import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = resolveDatabaseUrl();

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Prisma's raw error logger may print mutation payloads. Routes/worker emit
    // sanitized error categories instead; never log customer fields or secrets.
    log: [],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
