import "server-only";

import ExcelJS from "exceljs";
import { OpportunityStage, Prisma, Role } from "@prisma/client";
import { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { mappingProspectScope, requireBranch } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { mappingMarkerIconOptions, mappingMarkerIcons } from "@/lib/mapping-icons";
import { loadMappingXlsx } from "@/lib/mapping-xlsx-reader";
import { createAssignmentNotification } from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import { makeCode } from "@/lib/utils";

const MAX_ROWS = 250;
const MAX_BYTES = 1_500_000;
const EXPORT_LIMIT = 5_000;
const sheetName = "Mapping";
const columns = [
  ["kode_internal", "Kosong untuk lokasi baru; isi bersama versi untuk memperbarui lokasi existing"],
  ["versi", "Wajib hanya jika kode_internal diisi; ambil dari ekspor terbaru"],
  ["kode_cabang", "Otomatis cabang akun; wajib bagi ADMIN lintas cabang"],
  ["nama_usaha", "Wajib untuk lokasi baru"],
  ["label_lokasi", "Opsional; otomatis nama_usaha jika kosong"],
  ["latitude", "Opsional; jika diisi longitude juga wajib. Angka -90 s.d. 90"],
  ["longitude", "Opsional; jika diisi latitude juga wajib. Angka -180 s.d. 180"],
  ["pic_email", "Otomatis akun pengimpor bila satu cabang; wajib bagi ADMIN lintas cabang"],
  ["area_blok", "Opsional"],
  ["sektor_usaha", "Opsional"],
  ["petunjuk_lokasi", "Opsional; tanpa data rahasia"],
  ["kebutuhan_produk", "Opsional; pisahkan dengan titik koma (;)"],
  ["kebutuhan", "Opsional; otomatis 'Belum dikonfirmasi'"],
  ["ikon", "Opsional; default STORE"],
] as const;

const requiredColumns = new Set([4]);
const conditionalColumns = new Set([1, 2, 3, 8]);
const headerColors = { required: "FF047857", optional: "FF245A91", conditional: "FFB45309" };

const iconExamples: Record<(typeof mappingMarkerIcons)[number], string> = {
  STORE: "🏬", FOOD: "🍽️", MARKET: "🛒", OFFICE: "🏢", HEALTH: "🏥",
  SERVICE: "🛠️", TOWER: "🏙️", CAFE: "☕", BAKERY: "🥐", HOTEL: "🏨",
  SCHOOL: "🏫", WAREHOUSE: "📦", FACTORY: "🏭", BANK: "🏦", PHARMACY: "💊",
  SALON: "✂️", GYM: "🏋️", AUTO: "🚗", ELECTRONICS: "💻", FASHION: "👗",
  FLORIST: "💐", HOUSE: "🏠", MALL: "🛍️", LOGISTICS: "🚚", WORSHIP: "🕌",
  PARK: "🌳",
};

const rowSchema = z.object({
  code: z.string().max(30),
  version: z.number().int().positive().nullable(),
  branchCode: z.string().max(10),
  businessAlias: z.string().max(120),
  locationLabel: z.string().max(120),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  picEmail: z.email().or(z.literal("")),
  areaBlock: z.string().max(100),
  businessSector: z.string().max(100),
  addressHint: z.string().max(220),
  productNeeds: z.array(z.string().min(2).max(80)).max(12),
  need: z.string().max(500),
  markerIcon: z.enum(mappingMarkerIcons).or(z.literal("")),
});

type ParsedRow = z.infer<typeof rowSchema> & { row: number };
type PlannedRow = ParsedRow & { branchId: string; assigneeId: string; existingId?: string };

function safeText(value: unknown): string {
  const text = String(value ?? "");
  return /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
}

function cellText(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Hyperlink) {
    throw new Error("Rumus dan hyperlink tidak diizinkan dalam data impor.");
  }
  if (cell.value && typeof cell.value === "object") {
    throw new Error("Gunakan teks atau angka biasa, bukan rich text/objek.");
  }
  return String(cell.value ?? "").trim();
}

function makeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MABES LINK";
  const paintHeader = (cell: ExcelJS.Cell, index: number) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb:
      requiredColumns.has(index) ? headerColors.required :
        conditionalColumns.has(index) ? headerColors.conditional : headerColors.optional } };
    cell.alignment = { vertical: "middle" };
    cell.note = columns[index - 1][1];
  };
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(([header]) => ({ header, key: header, width: Math.max(16, header.length + 3) }));
  sheet.autoFilter = { from: "A1", to: "N1" };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell(paintHeader);
  sheet.getColumn(6).numFmt = "0.0000000";
  sheet.getColumn(7).numFmt = "0.0000000";
  sheet.getColumn(14).width = 22;
  // ExcelJS mendukung range validasi saat runtime, tetapi properti ini belum ada pada tipenya.
  // Menulis range langsung menjaga baris 2 tetap kosong agar addRow() mengisi baris data pertama.
  const validations = (sheet as unknown as { dataValidations: { add: (address: string, rule: object) => void } }).dataValidations;
  validations.add(`F2:F${MAX_ROWS + 1}`, { type: "decimal", operator: "between", allowBlank: true, formulae: [-90, 90], showErrorMessage: true, error: "Latitude harus -90 sampai 90." });
  validations.add(`G2:G${MAX_ROWS + 1}`, { type: "decimal", operator: "between", allowBlank: true, formulae: [-180, 180], showErrorMessage: true, error: "Longitude harus -180 sampai 180." });
  validations.add(`N2:N${MAX_ROWS + 1}`, { type: "list", allowBlank: true, formulae: [`"${mappingMarkerIcons.join(",")}"`] });
  const guide = workbook.addWorksheet("Petunjuk", { views: [{ state: "frozen", ySplit: 7 }] });
  guide.columns = [{ width: 25 }, { width: 90 }];
  guide.getCell("A1").value = "PANDUAN TEMPLATE MAPPING";
  guide.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF123461" } };
  guide.getCell("A2").value = "HIJAU · WAJIB";
  guide.getCell("B2").value = "nama_usaha wajib untuk lokasi baru.";
  guide.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors.required } };
  guide.getCell("A3").value = "BIRU · OPSIONAL";
  guide.getCell("B3").value = "Boleh kosong. Latitude dan longitude harus diisi bersama jika Anda memiliki koordinat; tanpa koordinat lokasi masuk daftar, belum muncul sebagai pin.";
  guide.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors.optional } };
  guide.getCell("A4").value = "KUNING · KONDISIONAL";
  guide.getCell("B4").value = "kode_internal + versi untuk update; kode_cabang + pic_email untuk ADMIN lintas cabang.";
  guide.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColors.conditional } };
  for (const row of [2, 3, 4]) guide.getCell(`A${row}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getCell("A5").value = "CONTOH";
  guide.getCell("B5").value = "Lihat sheet Contoh. Baris contoh tidak ikut diimpor; salin ke Mapping dan ganti dengan data samaran/yang diizinkan.";
  guide.getCell("A6").value = "KOORDINAT";
  guide.getCell("B6").value = "Contoh format: -6.1450000 dan 106.8180000. Jangan isi 0,0 hanya karena belum tahu lokasi. 0,0 sendiri adalah titik valid.";
  guide.getCell("A7").value = "Kolom";
  guide.getCell("B7").value = "Aturan";
  guide.getRow(7).font = { bold: true };
  columns.forEach(([name, rule]) => guide.addRow([name, rule]));
  guide.addRow([]);
  guide.addRow(["Cara pakai", "Tambah baris di sheet Mapping. Untuk update, mulai dari ekspor terbaru dan jangan ganti kode_internal/versi."]);
  guide.addRow(["Keamanan", "Jangan masukkan CIF, rekening, nomor telepon, saldo, dokumen, atau data pribadi lain."]);
  guide.addRow(["Status", "Impor lokasi baru tidak memverifikasi penggunaan produk. Periksa pratinjau sebelum simpan."]);

  const example = workbook.addWorksheet("Contoh", { views: [{ state: "frozen", ySplit: 3 }] });
  example.columns = columns.map(([header]) => ({ key: header, width: Math.max(18, header.length + 3) }));
  example.mergeCells("A1:N1");
  example.getCell("A1").value = "CONTOH DATA SAMARAN · TIDAK IKUT DIIMPOR";
  example.getCell("A1").font = { bold: true, color: { argb: "FF123461" }, size: 14 };
  example.getRow(3).values = columns.map(([name]) => name);
  example.getRow(3).eachCell(paintHeader);
  example.getRow(4).values = [null, null, "11539", "Kedai Contoh Samaran", "Ruko contoh dekat pasar", null, null, null, "Blok A", "Kuliner", "Samping pintu pasar", "QRIS; Livin' Merchant", "Kebutuhan belum dikonfirmasi", "CAFE"];
  example.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FF" } };
  example.getCell("A6").value = "Salin baris 4 ke sheet Mapping, lalu ganti semua data contoh. Latitude/longitude pada contoh sengaja kosong: keduanya opsional.";
  example.mergeCells("A6:N6");
  example.getCell("A7").value = "Kode ikon CAFE berarti Kafe; lihat sheet Pilihan Ikon untuk semua kode dan contoh visualnya.";
  example.mergeCells("A7:N7");

  const icons = workbook.addWorksheet("Pilihan Ikon", { views: [{ state: "frozen", ySplit: 1 }] });
  icons.columns = [{ header: "Kode untuk kolom ikon", width: 26 }, { header: "Contoh visual", width: 19 }, { header: "Nama", width: 24 }, { header: "Keterangan", width: 30 }];
  icons.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  icons.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123461" } };
  for (const option of mappingMarkerIconOptions) icons.addRow([option.value, iconExamples[option.value], option.label, option.description]);
  icons.addRow([]);
  icons.addRow(["Catatan", "Contoh visual hanya panduan; bentuk ikon pada peta mengikuti pilihan aplikasi."]);
  return { workbook, sheet };
}

export async function templateWorkbook() {
  const { workbook } = makeWorkbook();
  return workbook.xlsx.writeBuffer();
}

export async function exportWorkbook(actor: Actor) {
  const where: Prisma.ProspectWhereInput = {
    AND: [mappingProspectScope(actor), { OR: [
      { usageVerifications: { some: { status: "VERIFIED" } } },
      { publicQrisRequestId: { not: null } },
      { mappingImportedAt: { not: null } },
      { mappingDiscovery: { isNot: null } },
    ] }],
  };
  const total = await db.prospect.count({ where });
  if (total > EXPORT_LIMIT) throw new AppError(`Ekspor dibatasi ${EXPORT_LIMIT} lokasi. Hubungi admin untuk ekspor besar.`, 422, "EXPORT_LIMIT");
  const items = await db.prospect.findMany({
    where,
    select: { internalCode: true, version: true, businessAlias: true, locationLabel: true,
      latitude: true, longitude: true, areaBlock: true, businessSector: true,
      addressHint: true, productNeeds: true, need: true, mappingMarkerIcon: true,
      mappingDiscovery: { select: { sourceNeedHint: true } },
      branch: { select: { code: true } }, assignedTo: { select: { email: true } },
    },
    orderBy: { internalCode: "asc" },
  });
  const { workbook, sheet } = makeWorkbook();
  for (const item of items) {
    sheet.addRow([
      item.internalCode, item.version, item.branch.code, safeText(item.businessAlias),
      safeText(item.locationLabel), item.latitude == null ? "" : Number(item.latitude),
      item.longitude == null ? "" : Number(item.longitude), item.assignedTo.email,
      safeText(item.areaBlock), safeText(item.businessSector), safeText(item.addressHint),
      safeText(item.productNeeds.join("; ")), safeText(item.mappingDiscovery?.sourceNeedHint ?? item.need), item.mappingMarkerIcon,
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  await writeAudit(db, actor, { entityType: "MappingExport", entityId: actor.id,
    action: "MAPPING_EXCEL_EXPORTED", after: { count: items.length } });
  return buffer;
}

export async function parseMappingWorkbook(file: File): Promise<{ rows: ParsedRow[]; errors: { row: number; message: string }[] }> {
  if (file.size > MAX_BYTES || file.size < 100 || !file.name.toLowerCase().endsWith(".xlsx"))
    throw new AppError("Pilih berkas .xlsx maksimal 1,5 MB.", 422, "INVALID_FILE");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new AppError("Berkas bukan XLSX yang valid.", 422, "INVALID_FILE");
  const workbook = await loadMappingXlsx(bytes);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new AppError("Sheet Mapping tidak ditemukan. Gunakan template terbaru.", 422, "INVALID_TEMPLATE");
  if (sheet.rowCount > MAX_ROWS + 1) throw new AppError(`Maksimal ${MAX_ROWS} baris per impor.`, 422, "ROW_LIMIT");
  const headers = columns.map(([name]) => name);
  if (headers.some((header, index) => sheet.getRow(1).getCell(index + 1).value !== header))
    throw new AppError("Kolom template berubah. Unduh template terbaru.", 422, "INVALID_TEMPLATE");
  const rows: ParsedRow[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  for (let number = 2; number <= sheet.rowCount; number++) {
    const cells = sheet.getRow(number);
    if (!cells.hasValues) continue;
    try {
      const values = headers.map((_, index) => cellText(cells.getCell(index + 1)));
      const [code, version, branchCode, businessAlias, locationLabel, latitude, longitude,
        picEmail, areaBlock, businessSector, addressHint, productNeeds, need, markerIcon] = values;
      if (!code && businessAlias.length < 2) throw new Error("nama_usaha wajib untuk baris baru (min. 2 karakter).");
      if (code && !version) throw new Error("versi wajib saat kode_internal diisi.");
      if (Boolean(latitude) !== Boolean(longitude)) throw new Error("latitude dan longitude harus diisi berpasangan.");
      const parsed = rowSchema.parse({ code, version: version ? Number(version) : null,
        branchCode, businessAlias, locationLabel, latitude: latitude ? Number(latitude.replace(",", ".")) : null,
        longitude: longitude ? Number(longitude.replace(",", ".")) : null, picEmail: picEmail.toLowerCase(),
        areaBlock, businessSector, addressHint,
        productNeeds: productNeeds.split(";").map((part) => part.trim()).filter(Boolean),
        need, markerIcon });
      const key = code || `${branchCode.toLowerCase()}|${businessAlias.toLowerCase()}|${parsed.latitude}|${parsed.longitude}`;
      if (seen.has(key)) throw new Error("Duplikat baris dalam berkas.");
      seen.add(key);
      rows.push({ row: number, ...parsed });
    } catch (error) {
      errors.push({ row: number, message: error instanceof z.ZodError
        ? `${String(error.issues[0]?.path[0] ?? "data")}: ${error.issues[0]?.message}`
        : error instanceof Error ? error.message : "Data tidak valid." });
    }
  }
  if (!rows.length && !errors.length) errors.push({ row: 2, message: "Sheet Mapping belum berisi data." });
  return { rows, errors };
}

export async function planMappingImport(actor: Actor, file: File) {
  const parsed = await parseMappingWorkbook(file);
  const errors = [...parsed.errors];
  const planned: PlannedRow[] = [];
  const branchCodes = [...new Set(parsed.rows.map((row) => row.branchCode).filter(Boolean))];
  const branches = await db.branch.findMany({ where: { OR: branchCodes.map((code) => ({ code: { equals: code, mode: "insensitive" as const } })) }, select: { id: true, code: true } });
  const branchByCode = new Map(branches.map((branch) => [branch.code.toLowerCase(), branch.id]));
  const emails = [...new Set(parsed.rows.map((row) => row.picEmail).filter(Boolean))];
  const users = await db.user.findMany({ where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })), active: true, isTest: false }, select: { id: true, email: true, branchId: true } });
  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const codes = parsed.rows.map((row) => row.code).filter(Boolean);
  const existing = await db.prospect.findMany({ where: { internalCode: { in: codes }, AND: [mappingProspectScope(actor),
    { OR: [{ usageVerifications: { some: { status: "VERIFIED" } } }, { publicQrisRequestId: { not: null } }, { mappingImportedAt: { not: null } }, { mappingDiscovery: { isNot: null } }] }] },
    select: { id: true, internalCode: true, branchId: true, version: true, assignedToId: true } });
  const byCode = new Map(existing.map((item) => [item.internalCode, item]));
  for (const row of parsed.rows) {
    try {
      const current = row.code ? byCode.get(row.code) : undefined;
      if (row.code && !current) throw new Error("kode_internal tidak ditemukan atau di luar akses Anda.");
      if (current && current.version !== row.version) throw new Error("Versi berubah; ekspor ulang sebelum impor.");
      const branchId = current?.branchId ?? (actor.role === Role.ADMIN
        ? (row.branchCode ? branchByCode.get(row.branchCode.toLowerCase()) : actor.branchId ?? undefined)
        : requireBranch(actor));
      if (!branchId) throw new Error("kode_cabang wajib dan harus terdaftar.");
      if (row.branchCode && branchByCode.get(row.branchCode.toLowerCase()) !== branchId) throw new Error("kode_cabang tidak sesuai cakupan/record.");
      const assignee = row.picEmail ? userByEmail.get(row.picEmail) : current
        ? { id: current.assignedToId, branchId } : actor.branchId === branchId ? { id: actor.id, branchId } : undefined;
      if (!assignee || assignee.branchId !== branchId) throw new Error("pic_email harus akun aktif pada cabang lokasi; ADMIN lintas cabang wajib mengisinya.");
      if (current && assignee.id !== current.assignedToId) throw new Error("PIC record existing tidak diubah lewat Excel; gunakan alur penugasan agar tugas terkait tetap konsisten.");
      if (!current) {
        const duplicate = await db.prospect.findFirst({ where: { branchId, isTest: false,
          businessAlias: { equals: row.businessAlias, mode: "insensitive" },
          ...(row.latitude != null && row.longitude != null
            ? { latitude: row.latitude, longitude: row.longitude } : {}) }, select: { id: true } });
        if (duplicate) throw new Error(row.latitude == null
          ? "Nama usaha sudah ada di cabang ini; tanpa koordinat tidak bisa dipastikan ini lokasi berbeda. Gunakan kode_internal dari ekspor atau periksa dengan supervisor."
          : "Titik/nama sudah ada. Gunakan kode_internal dari ekspor bila lokasi itu ada dalam cakupan Anda, atau hubungi supervisor.");
      }
      planned.push({ ...row, branchId, assigneeId: assignee.id, existingId: current?.id });
    } catch (error) { errors.push({ row: row.row, message: error instanceof Error ? error.message : "Data tidak valid." }); }
  }
  return { planned, errors, summary: { total: parsed.rows.length + parsed.errors.length,
    create: planned.filter((row) => !row.existingId).length,
    update: planned.filter((row) => row.existingId).length, invalid: errors.length },
  };
}

export async function commitMappingImport(actor: Actor, file: File, requestId?: string | null) {
  const plan = await planMappingImport(actor, file);
  if (plan.errors.length) throw new AppError("Perbaiki semua baris bermasalah sebelum impor.", 422, "IMPORT_INVALID", plan.errors);
  try { await db.$transaction(async (tx) => {
    for (const row of plan.planned) {
      const coordinates = row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude,
          locationSource: "WORKBOOK_UNVERIFIED", locationUpdatedAt: new Date() } : {};
      if (row.existingId) {
        const result = await tx.prospect.updateMany({ where: { id: row.existingId, version: row.version!,
          AND: [mappingProspectScope(actor)] }, data: { ...coordinates,
            ...(row.businessAlias ? { businessAlias: row.businessAlias } : {}),
            ...(row.locationLabel ? { locationLabel: row.locationLabel } : {}),
            ...(row.areaBlock ? { areaBlock: row.areaBlock } : {}),
            ...(row.businessSector ? { businessSector: row.businessSector } : {}),
            ...(row.addressHint ? { addressHint: row.addressHint } : {}),
            ...(row.productNeeds.length ? { productNeeds: row.productNeeds } : {}),
            ...(row.markerIcon ? { mappingMarkerIcon: row.markerIcon } : {}),
            version: { increment: 1 } } });
        if (result.count !== 1) throw new AppError(`Baris ${row.row}: record berubah; ekspor ulang.`, 409, "VERSION_CONFLICT");
        if (row.need) await tx.mappingDiscovery.upsert({ where: { prospectId: row.existingId },
          create: { prospectId: row.existingId, sourceNeedHint: row.need, sourceType: "UNKNOWN" },
          update: { sourceNeedHint: row.need, version: { increment: 1 } } });
        await writeAudit(tx, actor, { entityType: "Prospect", entityId: row.existingId,
          branchId: row.branchId, action: "MAPPING_EXCEL_UPDATED", requestId,
          after: { row: row.row, latitude: row.latitude, longitude: row.longitude, assignedToId: row.assigneeId } });
      } else {
        const duplicate = await tx.prospect.findFirst({ where: { branchId: row.branchId,
          businessAlias: { equals: row.businessAlias, mode: "insensitive" },
          ...(row.latitude != null && row.longitude != null
            ? { latitude: row.latitude, longitude: row.longitude } : {}) }, select: { id: true } });
        if (duplicate) throw new AppError(`Baris ${row.row}: lokasi/nama sudah ada; ekspor ulang atau periksa dengan supervisor.`, 409, "DUPLICATE_LOCATION");
        const prospect = await tx.prospect.create({ data: { ...coordinates,
          assignedToId: row.assigneeId,
          locationLabel: row.locationLabel || row.businessAlias,
          locationSource: row.latitude != null ? "WORKBOOK_UNVERIFIED" : null,
          mappingImportedAt: new Date(),
          mappingMarkerIcon: row.markerIcon || "STORE",
          areaBlock: row.areaBlock || null, businessSector: row.businessSector || null,
          addressHint: row.addressHint || null, productNeeds: row.productNeeds,
          internalCode: makeCode("PR-11539"), businessAlias: row.businessAlias,
          need: "Belum dikonfirmasi", contactPic: "Belum dicatat",
          branchId: row.branchId, createdById: actor.id,
          opportunityStage: OpportunityStage.NEW } });
        await tx.mappingDiscovery.create({ data: { prospectId: prospect.id, sourceNeedHint: row.need || null, sourceType: "UNKNOWN" } });
        await writeAudit(tx, actor, { entityType: "Prospect", entityId: prospect.id,
          branchId: row.branchId, action: "MAPPING_EXCEL_CREATED", requestId,
          after: { row: row.row, internalCode: prospect.internalCode,
            latitude: row.latitude, longitude: row.longitude, assignedToId: row.assigneeId,
            usageVerified: false } });
        await createAssignmentNotification(tx, { recipientId: row.assigneeId,
          branchId: row.branchId, type: "PIC_ASSIGNMENT", title: "Lokasi mapping ditambahkan",
          message: `${prospect.internalCode} masuk ke mapping Anda. Penggunaan belum diverifikasi.`,
          link: "/mapping", dedupKey: `mapping-import-created:${prospect.id}` });
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
      throw new AppError("Data berubah saat impor. Ekspor ulang, periksa pratinjau, lalu coba lagi.", 409, "IMPORT_CONFLICT");
    throw error;
  }
  return plan.summary;
}
