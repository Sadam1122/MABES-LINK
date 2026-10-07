import "./load-env";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../lib/db";
import { resolveDatabaseUrl } from "../lib/database-url";
import { parseMappingWorkbook } from "../lib/mapping-excel";
import { listMappingProspects } from "../lib/services/visits";

async function main() {
  const target = new URL(resolveDatabaseUrl());
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/mabeslink" ||
      process.env.DATABASE_PURPOSE === "testing")
    throw new Error("Verifikasi ini hanya untuk database lokal mabeslink.");
  const bytes = await readFile(path.resolve("MABES_LINK_Mapping_Mangga_Besar_2026-10-07.xlsx"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const parsed = await parseMappingWorkbook(new File([bytes], "MABES_LINK_Mapping_Mangga_Besar_2026-10-07.xlsx"));
  if (parsed.errors.length || parsed.rows.length !== 117) throw new Error("Workbook berubah atau tidak valid.");
  const expectedCodes = new Set(parsed.rows.map((row) => row.code));
  const [users, accounts, prospects, discoveries, serviceCases, followUps, usage, audit] = await Promise.all([
    db.user.count(), db.account.count(), db.prospect.findMany({ select: {
      id: true, internalCode: true, latitude: true, longitude: true, locationSource: true,
      mappingImportedAt: true, branch: { select: { code: true } },
    } }), db.mappingDiscovery.count(), db.serviceCase.count(), db.followUp.count(),
    db.usageVerification.count(), db.auditLog.count({ where: {
      action: "MAPPING_2026_WORKBOOK_SEEDED", entityId: digest,
    } }),
  ]);
  const validRows = prospects.filter((item) => expectedCodes.has(item.internalCode) &&
    item.branch.code === "11539" && item.latitude != null && item.longitude != null &&
    item.locationSource === "WORKBOOK_UNVERIFIED" && item.mappingImportedAt != null).length;
  const outbranch = await db.user.findFirst({ where: { role: "OUT_BRANCH", branch: { code: "11539" }, active: true },
    select: { id: true, name: true, email: true, role: true, branchId: true } });
  if (!outbranch) throw new Error("Akun OUTBRANCH cabang 11539 tidak ditemukan.");
  const visible = await listMappingProspects(outbranch, { page: 1, pageSize: 1000 });
  const result = { users, accounts, prospects: prospects.length, validWorkbookRows: validRows,
    visibleToOutbranch: visible.items.length, discoveries, serviceCases, followUps, usage, seedAudit: audit };
  console.log(JSON.stringify(result, null, 2));
  if (users !== 2 || accounts !== 2 || prospects.length !== 117 || validRows !== 117 || visible.items.length !== 117 ||
      discoveries !== 117 || serviceCases !== 0 || followUps !== 0 || usage !== 0 || audit !== 1)
    throw new Error("Verifikasi pasca-seed tidak sesuai; periksa database dan backup.");
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : "Verifikasi gagal."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
