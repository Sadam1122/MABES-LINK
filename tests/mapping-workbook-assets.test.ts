import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { googleMapsAddressSearchUrl, googleMapsLocationUrl, googleMapsNavigationUrl } from "@/lib/geo";
import { loadMappingXlsx } from "@/lib/mapping-xlsx-reader";
import { qrisTemplates, qrisTemplateZones } from "@/lib/qris-design";

describe("Workbook Mapping dan aset publik", () => {
  it("membaca SpreadsheetML dengan prefiks x tanpa mengubah sumber", async () => {
    const source = new ExcelJS.Workbook();
    const sheet = source.addWorksheet("Mapping");
    sheet.addRow(["kode_internal", "nama_usaha"]);
    sheet.addRow(["PR-TEST-1", "Usaha samaran"]);
    const original = Buffer.from(await source.xlsx.writeBuffer());
    const zip = await JSZip.loadAsync(original);
    for (const name of ["xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/sharedStrings.xml"]) {
      const entry = zip.file(name);
      if (!entry) continue;
      const xml = await entry.async("string");
      zip.file(name, xml
        .replace(/<(\/?)((?:workbook|sheets|sheet|worksheet|sheetData|row|c|v|sst|si|t)\b)/g, "<$1x:$2")
        .replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'));
    }
    const prefixed = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await loadMappingXlsx(prefixed);
    expect(parsed.getWorksheet("Mapping")?.getCell("B2").value).toBe("Usaha samaran");
    expect(original.equals(prefixed)).toBe(false);
  });

  it.each(qrisTemplates)("template $label memiliki berkas PNG sesuai zona render", async (template) => {
    const zone = qrisTemplateZones[template.id];
    expect(template.image).toBe(`/qris-template/${zone.file}`);
    const bytes = await readFile(path.join(process.cwd(), "public", "qris-template", zone.file));
    const info = await sharp(bytes).metadata();
    expect(info.format).toBe("png");
    expect(info.width).toBe(1064);
    expect(info.height).toBe(1478);
    expect(zone.qr.x + zone.qr.width).toBeLessThanOrEqual(info.width!);
    expect(zone.qr.y + zone.qr.height).toBeLessThanOrEqual(info.height!);
    expect(zone.bottom.y).toBeGreaterThan(zone.qr.y + zone.qr.height);
  });

  it("Google Maps URLs memakai koordinat/parameter saja tanpa API key", () => {
    const point = { latitude: -6.1512345, longitude: 106.8212345 };
    const search = new URL(googleMapsLocationUrl(point));
    const route = new URL(googleMapsNavigationUrl(point));
    const address = new URL(googleMapsAddressSearchUrl("Mangga Besar Raya 81"));
    expect(search.searchParams.get("query")).toBe("-6.1512345,106.8212345");
    expect(route.searchParams.get("destination")).toBe("-6.1512345,106.8212345");
    expect(route.searchParams.get("dir_action")).toBe("navigate");
    expect(address.searchParams.get("query")).toBe("Mangga Besar Raya 81");
    expect(search.searchParams.has("key")).toBe(false);
  });
});
