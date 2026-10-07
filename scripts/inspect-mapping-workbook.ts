import "./load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";

import { loadMappingXlsx } from "../lib/mapping-xlsx-reader";
import { parseMappingWorkbook } from "../lib/mapping-excel";
import { db } from "../lib/db";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Berikan path workbook XLSX.");
  const bytes = await readFile(path.resolve(file));
  let workbook;
  try {
    workbook = await loadMappingXlsx(bytes);
  } catch (error) {
    const raw = new ExcelJS.Workbook();
    try { await raw.xlsx.load(bytes as unknown as Parameters<typeof raw.xlsx.load>[0]); }
    catch (cause) { console.error("ExcelJS:", cause instanceof Error ? cause.message : String(cause)); }
    const zip = await JSZip.loadAsync(bytes);
    console.log("ZIP entries:", Object.keys(zip.files).filter((name) => name.startsWith("xl/")).slice(0, 80));
    throw error;
  }
  for (const sheet of workbook.worksheets) {
    console.log(JSON.stringify({
      sheet: sheet.name,
      rows: sheet.rowCount,
      columns: sheet.columnCount,
      headers: sheet.getRow(1).values,
    }));
  }
  const parsed = await parseMappingWorkbook(new File([bytes], path.basename(file)));
  const groups = new Map<string, number[]>();
  for (const row of parsed.rows) {
    const key = `${row.businessAlias.trim().toLocaleLowerCase("id")}|${row.addressHint.trim().toLocaleLowerCase("id")}`;
    groups.set(key, [...(groups.get(key) ?? []), row.row]);
  }
  console.log(JSON.stringify({ validRows: parsed.rows.length, errors: parsed.errors,
    duplicates: [...groups.values()].filter((rows) => rows.length > 1),
    coordinates: parsed.rows.filter((row) => row.latitude != null && row.longitude != null).length,
    filledCodes: parsed.rows.filter((row) => row.code).length,
    filledPicEmails: parsed.rows.filter((row) => row.picEmail).length,
    distinctPicEmails: new Set(parsed.rows.map((row) => row.picEmail)).size,
    branchCodes: [...new Set(parsed.rows.map((row) => row.branchCode))],
    distinctCodes: new Set(parsed.rows.map((row) => row.code)).size,
    versions: Object.fromEntries([...new Set(parsed.rows.map((row) => row.version))].map((version) => [String(version), parsed.rows.filter((row) => row.version === version).length])),
    sectors: [...new Set(parsed.rows.map((row) => row.businessSector))].filter(Boolean).length,
    latitudeRange: [Math.min(...parsed.rows.map((row) => row.latitude ?? 90)), Math.max(...parsed.rows.map((row) => row.latitude ?? -90))],
    longitudeRange: [Math.min(...parsed.rows.map((row) => row.longitude ?? 180)), Math.max(...parsed.rows.map((row) => row.longitude ?? -180))],
  }));
  const radius = workbook.getWorksheet("Verifikasi Radius");
  if (radius) {
    for (const index of [7, 9]) {
      const counts = new Map<string, number>();
      for (let row = 2; row <= radius.rowCount; row++) {
        const raw = radius.getRow(row).getCell(index).value;
        const text = raw == null ? "" : String(raw);
        const key = !text ? "(kosong)" : /belum dicocokkan|belum diverifikasi/i.test(text) ? "belum diverifikasi" : /terverifikasi/i.test(text) ? "terverifikasi" : "lainnya";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      console.log(JSON.stringify({ sheet: "Verifikasi Radius", column: index, counts: [...counts] }));
    }
    const sourceExamples = new Set<string>();
    for (let row = 2; row <= radius.rowCount; row++) {
      const value = String(radius.getRow(row).getCell(7).value ?? "");
      if (value && !/belum dicocokkan|belum diverifikasi/i.test(value)) sourceExamples.add(value.slice(0, 110));
    }
    console.log(JSON.stringify({ sourceExamples: [...sourceExamples].slice(0, 5) }));
  }
  const existing = await db.prospect.findMany({ select: { internalCode: true, businessAlias: true, latitude: true, longitude: true } });
  const picEmails = [...new Set(parsed.rows.map((row) => row.picEmail))];
  const matchingPics = await db.user.count({ where: { active: true, isTest: false, email: { in: picEmails } } });
  const codes = new Set(existing.map((item) => item.internalCode));
  const names = new Set(existing.map((item) => item.businessAlias.trim().toLocaleLowerCase("id")));
  console.log(JSON.stringify({ existingProspects: existing.length,
    workbookCodesAlreadyInDb: parsed.rows.filter((row) => codes.has(row.code)).length,
    workbookNamesAlreadyInDb: parsed.rows.filter((row) => names.has(row.businessAlias.trim().toLocaleLowerCase("id"))).length,
    matchingPics }));
  await db.$disconnect();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Workbook gagal dibaca.");
  process.exitCode = 1;
});
