import { z } from "zod";
import { qrisStickerIds } from "@/lib/qris-stickers";

export const qrisTemplates = [
  {
    id: "BATIK_NUSANTARA",
    label: "Batik Nusantara",
    image: "/qris-template/template-batik-nusantara.png",
    primary: "#0b2248",
    secondary: "#c9a64b",
  },
  {
    id: "ALAM_INDONESIA",
    label: "Alam Indonesia",
    image: "/qris-template/template-alam-indonesia.png",
    primary: "#062b41",
    secondary: "#cfad67",
  },
] as const;

export const qrisTemplateZones = {
  BATIK_NUSANTARA: {
    file: "template-batik-nusantara.png",
    qr: { x: 148, y: 205, width: 768, height: 1044 },
    bottom: { x: 178, y: 1318, width: 708, height: 87 },
  },
  ALAM_INDONESIA: {
    file: "template-alam-indonesia.png",
    qr: { x: 207, y: 269, width: 650, height: 900 },
    bottom: { x: 116, y: 1325, width: 832, height: 94 },
  },
} as const;

export function isSuppliedQrisTemplate(template: string): template is keyof typeof qrisTemplateZones {
  return template in qrisTemplateZones;
}

export const qrisPlacedStickerSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([...qrisStickerIds, "UPLOAD"]),
  dataUrl: z.string().max(440_000).default(""),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().int().min(28).max(70),
});

export const qrisDesignSchema = z.object({
  template: z.enum(["BATIK_NUSANTARA", "ALAM_INDONESIA", "SIGNATURE", "HERITAGE", "FUTURE"]),
  size: z.enum(["A5", "A6"]),
  businessName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(100).default("Terima pembayaran dengan mudah"),
  social: z.string().trim().max(90).default(""),
  address: z.string().trim().max(100).default(""),
  logoDataUrl: z.string().max(700_000).default(""),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pattern: z.enum(["WAVES", "TOPOGRAPHY", "LINES", "NONE"]),
  frame: z.enum(["ROUND", "CLASSIC", "NONE"]),
  ornament: z.enum(["STAR", "LEAF", "SPARK", "NONE"]),
  inkSaver: z.boolean(),
  bottomText: z.string().trim().max(72).default(""),
  bottomFont: z.enum(["MODERN", "CLASSIC", "SCRIPT", "RETRO"]).default("MODERN"),
  bottomFontSize: z.number().int().min(18).max(40).default(32),
  bottomFontWeight: z.enum(["NORMAL", "BOLD"]).default("BOLD"),
  bottomColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#09345a"),
  qrZoom: z.number().min(0.7).max(1.4).default(1),
  qrPanX: z.number().min(-1).max(1).default(0),
  qrPanY: z.number().min(-1).max(1).default(0),
  stickers: z.array(qrisPlacedStickerSchema).max(3).default([]),
  sticker: z.enum(["NONE", ...qrisStickerIds, "UPLOAD"]).default("NONE"),
  stickerDataUrl: z.string().max(440_000).default(""),
  stickerSide: z.enum(["LEFT", "RIGHT"]).default("RIGHT"),
  stickerX: z.number().min(0).max(1).default(0.9),
  stickerY: z.number().min(0).max(1).default(0.5),
  stickerSize: z.number().int().min(32).max(70).default(58),
});

export type QrisDesign = z.infer<typeof qrisDesignSchema>;

export const publicQrisContactSchema = z
  .object({
    sessionId: z.string().min(1).max(80),
    token: z.string().min(20).max(100),
    requestId: z.string().uuid(),
    contactName: z.string().trim().max(100),
    businessName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30),
    businessCategory: z.string().trim().max(100),
    address: z.string().trim().max(220),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    locationSource: z.enum(["MAP_PIN", "DEVICE_GEOLOCATION", "MANUAL_ADDRESS"]),
    processingConsent: z.literal(true),
    contactConsent: z.boolean(),
    interestedProduct: z.enum([
      "QRIS",
      "LIVIN_MERCHANT",
      "EDC",
      "LIVIN_TABUNGAN",
      "KOPRA",
      "OTHER",
    ]),
    bankRelationship: z.enum(["CUSTOMER", "UNKNOWN", "NOT_CUSTOMER"]),
    contactWindow: z.string().trim().max(100).nullable(),
    needNote: z.string().trim().max(500).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.contactConsent && value.contactName.length < 2)
      ctx.addIssue({ code: "custom", path: ["contactName"], message: "Nama kontak wajib jika ingin dihubungi." });
    if ((value.contactConsent || value.phone) && !/^\+?[0-9][0-9\s()-]{7,29}$/.test(value.phone))
      ctx.addIssue({ code: "custom", path: ["phone"], message: value.contactConsent ? "Nomor HP valid wajib jika ingin dihubungi." : "Nomor HP belum valid." });
    if ((value.latitude == null) !== (value.longitude == null))
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Koordinat harus lengkap.",
      });
    if (value.locationSource !== "MANUAL_ADDRESS" && value.latitude == null)
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Pilih titik lokasi usaha.",
      });
  });
