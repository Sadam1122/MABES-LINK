import "./load-env";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OpportunityStage, Prisma } from "@prisma/client";

import { db } from "../lib/db";
import { resolveDatabaseUrl } from "../lib/database-url";
import { parseMappingWorkbook } from "../lib/mapping-excel";

const fileName = "MABES_LINK_Mapping_Mangga_Besar_2026-10-07.xlsx";
const expectedHash = "d7bbe8fe2786e5e67238f97a37b0a925c8360d6b41113ed4720b23ffdc8b3243";
const expectedRows = 117;
const seedAction = "MAPPING_2026_WORKBOOK_SEEDED";
const commit = process.argv.includes("--commit");
const replacePrior = process.argv.includes("--replace-prior-mapping");

function normalized(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("id").replace(/\s+/g, " ");
}

async function main() {
  const target = new URL(resolveDatabaseUrl());
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/mabeslink" ||
      process.env.DATABASE_PURPOSE === "testing")
    throw new Error("Seeder Mapping ini hanya untuk database lokal mabeslink.");

  const bytes = await readFile(path.resolve(process.cwd(), fileName));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expectedHash) throw new Error("Workbook berubah dari versi yang diperiksa. Seeder dibatalkan.");
  const parsed = await parseMappingWorkbook(new File([bytes], fileName));
  if (parsed.errors.length || parsed.rows.length !== expectedRows)
    throw new Error(`Workbook harus berisi ${expectedRows} baris Mapping valid; ditemukan ${parsed.rows.length} valid/${parsed.errors.length} error.`);
  const identities = new Set<string>();
  for (const row of parsed.rows) {
    if (row.branchCode !== "11539" || !row.code || !row.picEmail || row.version !== 1)
      throw new Error(`Baris ${row.row}: kode cabang, kode internal, PIC, atau versi tidak sesuai.`);
    if (row.latitude == null || row.longitude == null)
      throw new Error(`Baris ${row.row}: koordinat workbook berubah; tinjau ulang sumber.`);
    const identity = `${normalized(row.businessAlias)}|${normalized(row.addressHint)}`;
    if (identities.has(identity)) throw new Error(`Baris ${row.row}: nama+alamat duplikat dalam workbook.`);
    identities.add(identity);
  }
  const branch = await db.branch.findUnique({ where: { code: "11539" }, select: { id: true } });
  if (!branch) throw new Error("Cabang 11539 tidak ada; akun/cabang tidak dibuat oleh seeder Mapping.");
  const picEmails = [...new Set(parsed.rows.map((row) => row.picEmail))];
  const pics = await db.user.findMany({ where: { email: { in: picEmails }, branchId: branch.id,
    active: true, isTest: false }, select: { id: true, email: true, role: true } });
  if (pics.length !== picEmails.length) throw new Error("PIC workbook tidak cocok dengan akun aktif cabang; akun tidak diubah.");
  const picByEmail = new Map(pics.map((pic) => [pic.email.toLowerCase(), pic]));
  const existing = await db.prospect.findMany({ where: { branchId: branch.id }, select: {
    id: true, internalCode: true, businessAlias: true, addressHint: true, version: true,
    mappingImportedAt: true, publicQrisRequestId: true, isTest: true,
    _count: { select: { followUps: true, handoverItems: true, exceptionCases: true,
      usageVerifications: true, visits: true, serviceCases: true, locationPhotos: true,
      mappingOpportunities: true } },
  } });
  const priorAudit = await db.auditLog.findFirst({ where: { branchId: branch.id,
    action: seedAction, entityId: digest }, select: { id: true } });
  const codes = new Set(existing.map((item) => item.internalCode));
  const codeOverlap = parsed.rows.filter((row) => codes.has(row.code)).length;
  const nameOverlap = parsed.rows.filter((row) => existing.some((item) =>
    normalized(item.businessAlias) === normalized(row.businessAlias))).length;
  const output = { mode: commit ? "commit" : "preview", workbookSha256: digest, rows: parsed.rows.length,
    coordinateStatus: "WORKBOOK_UNVERIFIED", existingProspects: existing.length,
    codeOverlap, nameOverlap, replacementRequested: replacePrior, priorSeed: Boolean(priorAudit) };
  console.log(JSON.stringify(output, null, 2));
  if (priorAudit) {
    if (codeOverlap === expectedRows && existing.length === expectedRows) {
      console.log("Seed workbook sudah ada; tidak membuat duplikat atau mengubah pekerjaan petugas.");
      return;
    }
    throw new Error("Audit seed ada, tetapi data berbeda. Perlu rekonsiliasi manual.");
  }
  if (!commit) return;
  if (existing.length && !replacePrior)
    throw new Error("Database Mapping tidak kosong. Gunakan --replace-prior-mapping hanya setelah backup dan pemeriksaan data lama.");
  if (replacePrior) {
    if (existing.length !== 42 || existing.some((item) => !item.mappingImportedAt || item.version !== 1 ||
      item.publicQrisRequestId || item.isTest || Object.values(item._count).some((count) => count > 0)))
      throw new Error("Record lama tidak lagi persis 42 seed Mapping tanpa pekerjaan terkait; penggantian dibatalkan.");
  }
  if (codeOverlap) throw new Error("Kode internal workbook sudah digunakan; penggantian dibatalkan.");
  const actor = await db.user.findFirst({ where: { branchId: branch.id, role: "ADMIN", active: true, isTest: false },
    select: { id: true, name: true, role: true } });
  if (!actor) throw new Error("ADMIN aktif tidak ada; akun tidak dibuat oleh seeder Mapping.");

  await db.$transaction(async (tx) => {
    if (await tx.auditLog.findFirst({ where: { branchId: branch.id, action: seedAction, entityId: digest } }))
      throw new Error("Seed sudah dilakukan oleh proses lain.");
    const current = await tx.prospect.findMany({ where: { branchId: branch.id }, select: {
      id: true, version: true,
      _count: { select: { followUps: true, handoverItems: true, exceptionCases: true,
        usageVerifications: true, visits: true, serviceCases: true, locationPhotos: true,
        mappingOpportunities: true } },
    } });
    if (current.length !== existing.length || current.some((item) => !existing.some((prior) => prior.id === item.id && prior.version === item.version)))
      throw new Error("Data Mapping berubah sejak pratinjau; transaksi dibatalkan.");
    if (replacePrior && current.some((item) => Object.values(item._count).some((count) => count > 0)))
      throw new Error("Ada pekerjaan baru terkait Mapping lama; penggantian dibatalkan.");
    if (replacePrior) await tx.prospect.deleteMany({ where: { id: { in: existing.map((item) => item.id) } } });
    for (const row of parsed.rows) {
      const pic = picByEmail.get(row.picEmail)!;
      const prospect = await tx.prospect.create({ data: {
        internalCode: row.code, businessAlias: row.businessAlias,
        need: "Belum dikonfirmasi", contactPic: "Belum dicatat",
        branchId: branch.id, assignedToId: pic.id, createdById: actor.id,
        opportunityStage: OpportunityStage.NEW, locationLabel: row.locationLabel || row.businessAlias,
        areaBlock: row.areaBlock || null, businessSector: row.businessSector || null,
        addressHint: row.addressHint || null, productNeeds: row.productNeeds,
        latitude: new Prisma.Decimal(row.latitude!), longitude: new Prisma.Decimal(row.longitude!),
        locationSource: "WORKBOOK_UNVERIFIED", locationUpdatedAt: new Date(),
        mappingImportedAt: new Date(), mappingMarkerIcon: row.markerIcon || "STORE",
      } });
      await tx.mappingDiscovery.create({ data: { prospectId: prospect.id,
        sourceNeedHint: row.need || null, sourceType: "WORKBOOK_UNVERIFIED" } });
    }
    await tx.auditLog.create({ data: { branchId: branch.id, actorId: actor.id,
      actorName: actor.name, actorRole: actor.role, entityType: "MappingImport", entityId: digest,
      action: seedAction, after: { workbookSha256: digest, count: expectedRows,
        replacedPrior: replacePrior ? existing.length : 0, coordinateStatus: "unverified",
        accountChanges: false } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
  console.log(`Seed Mapping selesai: ${expectedRows} lokasi; akun tidak diubah. Semua koordinat bertanda belum diverifikasi.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed Mapping gagal.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
