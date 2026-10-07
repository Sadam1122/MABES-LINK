import "./load-env";

import { Role } from "@prisma/client";
import { db } from "../lib/db";
import { resolveDatabaseUrl } from "../lib/database-url";

async function main() {
  const target = new URL(resolveDatabaseUrl());
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/mabeslink")
    throw new Error("Inspeksi reset hanya untuk database lokal mabeslink.");
  const [admins, users, prospects, serviceCases, followUps, banners, audits] = await Promise.all([
    db.user.findMany({ where: { role: Role.ADMIN, active: true, isTest: false },
      select: { email: true, name: true }, take: 3 }),
    db.user.count(), db.prospect.count(), db.serviceCase.count(), db.followUp.count(),
    db.homeBanner.count().catch(() => -1), db.auditLog.count(),
  ]);
  console.log(JSON.stringify({ target: { host: target.hostname, database: target.pathname.slice(1) },
    admins, counts: { users, prospects, serviceCases, followUps, banners, audits } }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Inspeksi gagal.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
