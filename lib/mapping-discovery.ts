import { FoodScreenRule, MappingOfferResponse } from "@prisma/client";
import { z } from "zod";

export const mappingSegments = ["PEMBISNIS", "PAYROLL", "PRIORITAS", "INDIVIDU"] as const;
export const mappingOpportunityTags = [
  "LIVIN_FOOD_SCREEN", "LIVIN_MERCHANT_QRIS", "KOPRA_WHOLESALE",
  "HOTEL", "HEALTHCARE", "CULINARY", "OFFICE", "OTHER",
] as const;

// Nama publik diverifikasi dari situs Bank Mandiri; izin penawaran internal tetap
// berasal dari MAPPING_APPROVED_PRODUCT_CODES, bukan dari daftar ini.
export const mappingProductCatalog = [
  { code: "LIVIN_MERCHANT_QRIS", label: "QRIS Livin’ Merchant", source: "https://www.bankmandiri.co.id/en/livin-merchant/metode-pembayaran" },
  { code: "LIVIN_MERCHANT_EDC", label: "EDC Mandiri / Livin’ Merchant", source: "https://www.bankmandiri.co.id/en/livin-merchant/metode-pembayaran" },
  { code: "KOPRA_CASH_MANAGEMENT", label: "Kopra Cash Management", source: "https://www.bankmandiri.co.id/in/cash-management1" },
  { code: "LIVIN_ACCOUNT_OPENING", label: "Pembukaan Rekening melalui Livin’ by Mandiri", source: "https://www.bankmandiri.co.id/en/livin/edukasi/cara-daftar-dan-aktivasi" },
] as const;

export function approvedMappingProducts(env = process.env.MAPPING_APPROVED_PRODUCT_CODES ?? "") {
  const allowed = new Set(env.split(",").map((part) => part.trim()).filter(Boolean));
  return mappingProductCatalog.filter((product) => allowed.has(product.code));
}

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const nullableHttpsUrl = z.string().trim().url().max(300).refine((value) => value.startsWith("https://"), "Gunakan URL HTTPS.").nullable();
const nullableDate = z.coerce.date().nullable();

export const mappingDiscoverySchema = z.object({
  version: z.number().int().min(0),
  segments: z.array(z.enum(mappingSegments)).max(4).default([]),
  opportunityTags: z.array(z.enum(mappingOpportunityTags)).max(8).default([]),
  usedProductsKnown: z.boolean(),
  usedProducts: z.array(z.enum(mappingProductCatalog.map((product) => product.code))).max(5).default([]),
  usedProductsOther: nullableText(120),
  sourceType: z.enum(["PUBLIC_DIRECTORY", "FIELD_DISCOVERY", "INTERNAL_ALLOWED", "UNKNOWN"]).nullable(),
  sourceUrl: nullableHttpsUrl,
  sourceCheckedAt: nullableDate,
  riskReviewRequired: z.boolean(),
  foodRule: z.nativeEnum(FoodScreenRule),
  gofoodRating: z.number().min(0).max(5).nullable(),
  gofoodReviews: z.number().int().min(0).max(100_000_000).nullable(),
  gofoodUrl: nullableHttpsUrl,
  gofoodCheckedAt: nullableDate,
  grabfoodRating: z.number().min(0).max(5).nullable(),
  grabfoodReviews: z.number().int().min(0).max(100_000_000).nullable(),
  grabfoodUrl: nullableHttpsUrl,
  grabfoodCheckedAt: nullableDate,
}).superRefine((value, ctx) => {
  if (!value.usedProductsKnown && (value.usedProducts.length || value.usedProductsOther))
    ctx.addIssue({ code: "custom", path: ["usedProducts"], message: "Produk yang dipakai belum diketahui; kosongkan pilihan produk." });
  if (value.sourceUrl && !value.sourceCheckedAt)
    ctx.addIssue({ code: "custom", path: ["sourceCheckedAt"], message: "Isi tanggal pengecekan sumber." });
  for (const platform of ["gofood", "grabfood"] as const) {
    const rating = value[`${platform}Rating`];
    const reviews = value[`${platform}Reviews`];
    const url = value[`${platform}Url`];
    const checkedAt = value[`${platform}CheckedAt`];
    if ([rating, reviews, url, checkedAt].some((item) => item != null) &&
        [rating, reviews, url, checkedAt].some((item) => item == null))
      ctx.addIssue({ code: "custom", path: [`${platform}Rating`], message: "Rating, jumlah review, URL, dan tanggal cek harus lengkap untuk satu platform." });
  }
});

export type FoodData = {
  foodRule: FoodScreenRule;
  gofoodRating: number | null;
  gofoodReviews: number | null;
  gofoodCheckedAt: Date | null;
  grabfoodRating: number | null;
  grabfoodReviews: number | null;
  grabfoodCheckedAt: Date | null;
};

export function foodScreeningResult(data: FoodData, now = new Date(), staleDays = 30) {
  const platforms = (["gofood", "grabfood"] as const).map((key) => {
    const rating = data[`${key}Rating`];
    const reviews = data[`${key}Reviews`];
    const checkedAt = data[`${key}CheckedAt`];
    const complete = rating != null && reviews != null && checkedAt != null;
    const fresh = complete && checkedAt!.getTime() <= now.getTime() &&
      now.getTime() - checkedAt!.getTime() <= staleDays * 86_400_000;
    return { key, complete, fresh, passes: Boolean(fresh && rating! >= 4.5 && reviews! >= 500) };
  });
  const filled = platforms.filter((item) => item.complete);
  const candidate = data.foodRule === FoodScreenRule.BOTH
    ? platforms.every((item) => item.passes)
    : platforms.some((item) => item.passes);
  const status = candidate ? "CANDIDATE" :
    filled.some((item) => !item.fresh) ? "STALE" :
      data.foodRule === FoodScreenRule.BOTH && filled.length < 2 ? "NEEDS_DATA" :
        filled.length === 0 ? "NEEDS_DATA" : "NOT_MATCH";
  return { status, rule: data.foodRule, matchingPlatforms: platforms.filter((item) => item.passes).map((item) => item.key), staleDays };
}

export const mappingOpportunitySchema = z.object({
  productCode: z.string().trim().min(1).max(80),
  needSummary: z.string().trim().min(5).max(300),
  discoveryDone: z.boolean(),
  needConfirmed: z.boolean(),
  benefitExplained: z.boolean(),
  response: z.nativeEnum(MappingOfferResponse),
  followUpConsent: z.boolean().nullable(),
  nextAction: nullableText(300),
  dueAt: nullableDate,
  evidenceNote: nullableText(500),
  assignedToId: z.string().min(1),
  version: z.number().int().min(0),
}).superRefine((value, ctx) => {
  if (value.response !== MappingOfferResponse.NOT_ASKED && !value.discoveryDone)
    ctx.addIssue({ code: "custom", path: ["discoveryDone"], message: "Catat discovery sebelum menetapkan respons." });
  if ((value.response === MappingOfferResponse.INTERESTED || value.response === MappingOfferResponse.FOLLOW_UP) && !value.needConfirmed)
    ctx.addIssue({ code: "custom", path: ["needConfirmed"], message: "Kebutuhan harus dinyatakan calon nasabah sebelum melanjutkan penawaran." });
  if (value.benefitExplained && !value.needConfirmed)
    ctx.addIssue({ code: "custom", path: ["benefitExplained"], message: "Konfirmasi kebutuhan terlebih dahulu." });
  if ((value.response === MappingOfferResponse.INTERESTED || value.response === MappingOfferResponse.FOLLOW_UP) && !value.benefitExplained)
    ctx.addIssue({ code: "custom", path: ["benefitExplained"], message: "Catat bahwa manfaat relevan sudah dijelaskan." });
  if (value.response === MappingOfferResponse.FOLLOW_UP &&
      (!value.followUpConsent || !value.nextAction || !value.dueAt))
    ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Izin follow-up, next action, dan tanggal wajib untuk respons minta follow-up." });
  if (value.response !== MappingOfferResponse.FOLLOW_UP && value.dueAt)
    ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Jadwal hanya dipakai saat respons minta follow-up." });
  if (value.response !== MappingOfferResponse.NOT_ASKED && !value.evidenceNote)
    ctx.addIssue({ code: "custom", path: ["evidenceNote"], message: "Catat bukti proses non-sensitif, misalnya tanggal dan hasil diskusi." });
});

export function discoveryHints(sector: string | null) {
  const normalized = sector?.toLocaleLowerCase("id") ?? "";
  if (/hotel|akomodasi/.test(normalized)) return ["Bagaimana tamu membayar?", "Apakah ada kebutuhan pembayaran pemasok atau payroll yang dinyatakan? "];
  if (/klinik|rumah sakit|kesehatan/.test(normalized)) return ["Bagaimana pembayaran layanan dikelola?", "Apakah institusi menyatakan kebutuhan pembayaran dan payroll? Jangan catat data pasien."];
  if (/grosir|distributor/.test(normalized)) return ["Bagaimana pembayaran ke pemasok dan penerimaan dari pembeli?", "Apakah ada kebutuhan transaksi bisnis yang dinyatakan?"];
  return ["Bagaimana usaha menerima pembayaran saat ini?", "Kebutuhan transaksi apa yang dinyatakan oleh pengelola usaha?"];
}
