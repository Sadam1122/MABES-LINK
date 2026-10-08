import { describe, expect, it } from "vitest";
import {
  mappingDiscoverySchema,
  mappingProductCatalog,
  approvedMappingProducts,
} from "@/lib/mapping-discovery";
const blank = {
  version: 0,
  segments: [],
  opportunityTags: [],
  usedProductsKnown: true,
  usedProducts: [],
  usedProductsOther: null,
  sourceType: null,
  sourceUrl: null,
  sourceCheckedAt: null,
  riskReviewRequired: false,
  foodRule: "EITHER",
  gofoodRating: null,
  gofoodReviews: null,
  gofoodUrl: null,
  gofoodCheckedAt: null,
  grabfoodRating: null,
  grabfoodReviews: null,
  grabfoodUrl: null,
  grabfoodCheckedAt: null,
};
describe("Product Holding kompatibel dan tidak menyimpulkan kelayakan", () => {
  it("memuat Livin NOW/Merchant/Food/Sukha, KUM/KUR/CC, Kopra MCM/H2H tanpa kode duplikat", () => {
    const codes = mappingProductCatalog.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of [
      "MANDIRI_NOW_SAVINGS",
      "LIVIN_MERCHANT",
      "LIVIN_FOOD",
      "LIVIN_SUKHA",
      "MANDIRI_MICRO_LOAN",
      "MANDIRI_KUR",
      "MANDIRI_CREDIT_CARD",
      "KOPRA_CASH_MANAGEMENT",
      "KOPRA_H2H",
    ])
      expect(codes).toContain(code);
    expect(
      mappingDiscoverySchema.safeParse({ ...blank, usedProducts: codes })
        .success,
    ).toBe(true);
  });
  it("menolak duplikasi/tidak diketahui dan mempertahankan whitelist penawaran", () => {
    expect(
      mappingDiscoverySchema.safeParse({
        ...blank,
        usedProducts: ["MANDIRI_KUR", "MANDIRI_KUR"],
      }).success,
    ).toBe(false);
    expect(
      mappingDiscoverySchema.safeParse({
        ...blank,
        usedProductsKnown: false,
        usedProducts: ["MANDIRI_KUR"],
      }).success,
    ).toBe(false);
    expect(
      mappingDiscoverySchema.safeParse({
        ...blank,
        usedProducts: ["UNKNOWN_PRODUCT"],
      }).success,
    ).toBe(false);
    expect(approvedMappingProducts("")).toEqual([]);
    expect(
      approvedMappingProducts("KOPRA_CASH_MANAGEMENT").map((p) => p.code),
    ).toEqual(["KOPRA_CASH_MANAGEMENT"]);
  });
});
