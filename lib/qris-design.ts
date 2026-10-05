import { z } from "zod";

export const qrisTemplates = [
  {
    id: "SIGNATURE",
    label: "Mandiri Nusantara Signature",
    primary: "#0b2248",
    secondary: "#c9a64b",
  },
  {
    id: "HERITAGE",
    label: "Mandiri Heritage Indonesia",
    primary: "#f7f0dc",
    secondary: "#9e342e",
  },
  {
    id: "FUTURE",
    label: "Mandiri Archipelago Future",
    primary: "#071b37",
    secondary: "#20b9ef",
  },
] as const;

export const qrisDesignSchema = z.object({
  template: z.enum(["SIGNATURE", "HERITAGE", "FUTURE"]),
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
