import "server-only";

import ExcelJS from "exceljs";
import JSZip from "jszip";

import { AppError } from "@/lib/errors";

const MAX_UNCOMPRESSED_BYTES = 10_000_000;
const MAX_ENTRIES = 200;

// Beberapa XLSX hasil Excel/LibreOffice memakai target relasi komentar/tabel
// absolut yang tidak dapat direkonsiliasi ExcelJS 4.4. Sel/baris data tetap utuh;
// hanya dekorasi komentar, VML, dan definisi tabel yang dikeluarkan di memori.
async function withoutUnsupportedDecorations(bytes: Buffer) {
  const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entries = Object.values(archive.files);
  const expanded = entries.reduce((sum, entry) => sum + Number(
    (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
  ), 0);
  if (entries.length > MAX_ENTRIES || expanded > MAX_UNCOMPRESSED_BYTES)
    throw new AppError("Struktur XLSX terlalu besar untuk impor langsung.", 422, "XLSX_TOO_LARGE");
  for (const entry of entries) {
    if (entry.dir) continue;
    if (/^xl\/[^/]+(?:\/[^/]+)?\.xml$/.test(entry.name)) {
      const xml = await entry.async("string");
      // Beberapa pembuat workbook menulis seluruh elemen SpreadsheetML dengan
      // prefiks x:. ExcelJS 4.4 mencari elemen tanpa prefiks; ubah nama elemen
      // di arsip sementara saja. Isi sel dan workbook asli tetap utuh.
      const normalized = xml
        .replace(/<(\/?)x:/g, "<$1")
        .replace(/\sxmlns:x="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/g,
          ' xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"');
      archive.file(entry.name, normalized);
    }
    if (/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(entry.name)) {
      const xml = await entry.async("string");
      archive.file(entry.name, xml.replace(/<Relationship\b[^>]*\/>/g, (tag) =>
        /relationships\/(?:comments|vmlDrawing|table)"/.test(tag) ? "" : tag));
    } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name)) {
      const xml = await archive.file(entry.name)!.async("string");
      archive.file(entry.name, xml
        .replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, "")
        .replace(/<legacyDrawing\b[^>]*\/>/g, ""));
    }
  }
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function loadMappingXlsx(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    return workbook;
  } catch {
    try {
      const normalized = await withoutUnsupportedDecorations(bytes);
      const retry = new ExcelJS.Workbook();
      await retry.xlsx.load(normalized as unknown as Parameters<typeof retry.xlsx.load>[0]);
      return retry;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Berkas XLSX tidak dapat dibaca. Pastikan ini format .xlsx yang valid.", 422, "INVALID_FILE");
    }
  }
}
