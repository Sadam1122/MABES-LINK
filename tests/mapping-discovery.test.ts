import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { describe, expect, it } from "vitest";

import { foodScreeningResult, mappingDiscoverySchema, mappingOpportunitySchema } from "@/lib/mapping-discovery";

const workbookPath = resolve(process.cwd(), "link_mapping_6_Oktober_2026_REVISI.xlsx");
loadEnvConfig(process.cwd());

describe("discovery mapping dan kompatibilitas workbook", () => {
  const baseFood = {
    foodRule: "EITHER" as const, gofoodRating: 4.5, gofoodReviews: 500,
    gofoodCheckedAt: new Date("2026-10-05T00:00:00Z"),
    grabfoodRating: null, grabfoodReviews: null, grabfoodCheckedAt: null,
  };
  it("membedakan kandidat, kebutuhan dua platform, data lama, dan rating di bawah ambang", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    expect(foodScreeningResult(baseFood, now).status).toBe("CANDIDATE");
    expect(foodScreeningResult({ ...baseFood, foodRule: "BOTH" }, now).status).toBe("NEEDS_DATA");
    expect(foodScreeningResult({ ...baseFood, gofoodCheckedAt: new Date("2026-08-01T00:00:00Z") }, now).status).toBe("STALE");
    expect(foodScreeningResult({ ...baseFood, gofoodRating: 4.4 }, now).status).toBe("NOT_MATCH");
  });

  it("menolak rating tanpa sumber lengkap dan follow-up tanpa izin/jadwal", () => {
    const discovery = { version: 0, usedProductsKnown: false, usedProducts: [], usedProductsOther: null,
      sourceType: "UNKNOWN", sourceUrl: null, sourceCheckedAt: null, riskReviewRequired: false, foodRule: "EITHER",
      gofoodRating: 4.8, gofoodReviews: null, gofoodUrl: null, gofoodCheckedAt: null,
      grabfoodRating: null, grabfoodReviews: null, grabfoodUrl: null, grabfoodCheckedAt: null };
    expect(mappingDiscoverySchema.safeParse(discovery).success).toBe(false);
    expect(mappingOpportunitySchema.safeParse({ productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Butuh menerima pembayaran",
      discoveryDone: true, needConfirmed: true, benefitExplained: true, response: "FOLLOW_UP", followUpConsent: false,
      nextAction: null, dueAt: null, evidenceNote: "Diskusi produk 6 Oktober", assignedToId: "pic", version: 0 }).success).toBe(false);
  });

  it("menerima hasil tidak relevan tanpa memaksakan kebutuhan atau penawaran", () => {
    expect(mappingOpportunitySchema.safeParse({ productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Tidak ada kebutuhan QRIS",
      discoveryDone: true, needConfirmed: false, benefitExplained: false, response: "NOT_RELEVANT",
      followUpConsent: false, nextAction: null, dueAt: null, evidenceNote: "Hasil diskusi uji: tidak relevan",
      assignedToId: "pic", version: 0 }).success).toBe(true);
  });

  it("template tetap memiliki 14 kolom Mapping", async () => {
    const { templateWorkbook } = await import("@/lib/mapping-excel");
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await templateWorkbook()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet("Mapping")?.getRow(1).cellCount).toBe(14);
  });

  it.skipIf(!existsSync(workbookPath))("membaca workbook revisi pengguna tanpa menyimpan data", async () => {
    const { parseMappingWorkbook } = await import("@/lib/mapping-excel");
    const bytes = readFileSync(workbookPath);
    const file = new File([bytes], "link_mapping_6_Oktober_2026_REVISI.xlsx");
    const parsed = await parseMappingWorkbook(file);
    expect(parsed.rows).toHaveLength(42);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.every((row) => row.latitude === null && row.longitude === null)).toBe(true);
  });
});
