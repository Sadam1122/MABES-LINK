import { z } from "zod";

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
  sticker: z.enum(["NONE", "FLOWER", "STAR", "SPARKLE", "UPLOAD"]).default("NONE"),
  stickerDataUrl: z.string().max(440_000).default(""),
  stickerSide: z.enum(["LEFT", "RIGHT"]).default("RIGHT"),
  stickerY: z.number().min(0).max(1).default(0.5),
});

export type QrisDesign = z.infer<typeof qrisDesignSchema>;

export const publicQrisContactSchema = z
  .object({
    sessionId: z.string().min(1).max(80),
    token: z.string().min(20).max(100),
    requestId: z.string().uuid(),
    contactName: z.string().trim().min(2).max(100),
    businessName: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s()-]{7,29}$/),
    businessCategory: z.string().trim().min(2).max(100),
    address: z.string().trim().min(3).max(220),
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
