import "../scripts/load-env";

import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
import jsPDF from "jspdf";

import {
  decodeQris,
  hashValue,
  normalizeAndDecodeQris,
} from "@/lib/qris-custom";
import {
  qrisOutput,
  qrisProtectedRect,
  renderQrisDesign,
} from "@/lib/qris-render";
import { publicQrisContactSchema, type QrisDesign } from "@/lib/qris-design";

const payload =
  "0002010102122658QRIS-TEST-NO-LIVE-PAYMENT-MABES-LINK-1153953033605802ID6304TEST";
const design: QrisDesign = {
  template: "SIGNATURE",
  size: "A5",
  businessName: "Usaha Samaran",
  tagline: "Bayar dengan mudah",
  social: "",
  address: "",
  logoDataUrl: "",
  primary: "#0b2248",
  secondary: "#c9a64b",
  pattern: "WAVES",
  frame: "ROUND",
  ornament: "STAR",
  inkSaver: false,
  bottomText: "",
  bottomFont: "MODERN",
  bottomFontSize: 32,
  bottomFontWeight: "BOLD",
  bottomColor: "#09345a",
  qrZoom: 1,
  qrPanX: 0,
  qrPanY: 0,
  stickers: [],
  sticker: "NONE",
  stickerDataUrl: "",
  stickerSide: "RIGHT",
  stickerX: 0.9,
  stickerY: 0.5,
  stickerSize: 58,
};

describe("QRIS Custom publik", () => {
  it("mempertahankan isi QR dari sumber hingga PNG/JPG keluaran", async () => {
    const source = await QRCode.toBuffer(payload, {
      type: "png",
      width: 600,
      margin: 4,
    });
    const normalized = await normalizeAndDecodeQris(source, "image/png");
    expect(normalized.qrDigest).toBe(hashValue(payload));
    const result = await renderQrisDesign(
      normalized.data,
      design,
      normalized.qrDigest,
    );
    expect(await decodeQris(result.png)).toBe(payload);
    const left =
      result.bounds.x + Math.floor((result.bounds.protectedWidth - 600) / 2);
    const top =
      result.bounds.y + Math.floor((result.bounds.protectedHeight - 600) / 2);
    const embedded = await sharp(result.png)
      .extract({ left, top, width: 600, height: 600 })
      .raw()
      .toBuffer();
    const original = await sharp(normalized.data).raw().toBuffer();
    expect(embedded.equals(original)).toBe(true);
    const jpg = await qrisOutput(result.png, "jpg", "A5");
    expect(await decodeQris(jpg.data)).toBe(payload);
    const pdf = await qrisOutput(result.png, "pdf", "A5");
    expect(pdf.data.subarray(0, 5).toString()).toBe("%PDF-");
    expect(qrisProtectedRect("A5").protectedWidth).toBeGreaterThan(900);
  });

  it("menerima JPG dan PDF satu halaman yang kode QR-nya terbaca", async () => {
    const png = await QRCode.toBuffer(payload, {
      type: "png",
      width: 650,
      margin: 4,
    });
    const jpg = await sharp(png).jpeg({ quality: 98 }).toBuffer();
    expect((await normalizeAndDecodeQris(jpg, "image/jpeg")).qrDigest).toBe(
      hashValue(payload),
    );
    const pdf = new jsPDF({ unit: "mm", format: "a5" });
    pdf.addImage(png, "PNG", 15, 20, 118, 118);
    expect(
      (
        await normalizeAndDecodeQris(
          Buffer.from(pdf.output("arraybuffer")),
          "application/pdf",
        )
      ).qrDigest,
    ).toBe(hashValue(payload));
    pdf.addPage();
    await expect(
      normalizeAndDecodeQris(
        Buffer.from(pdf.output("arraybuffer")),
        "application/pdf",
      ),
    ).rejects.toMatchObject({ code: "PDF_PAGE_COUNT" });
  });

  it("logo usaha opsional tervalidasi tanpa menyentuh QR", async () => {
    const source = await QRCode.toBuffer(payload, { type: "png", width: 600 });
    const logo = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#c9a64b" },
    })
      .png()
      .toBuffer();
    const dataUrl = `data:image/png;base64,${logo.toString("base64")}`;
    const result = await renderQrisDesign(
      source,
      { ...design, logoDataUrl: dataUrl },
      hashValue(payload),
    );
    expect(await decodeQris(result.png)).toBe(payload);
    await expect(
      renderQrisDesign(
        source,
        { ...design, logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+" },
        hashValue(payload),
      ),
    ).rejects.toMatchObject({ code: "INVALID_LOGO" });
  });

  it("menolak isi file salah, QR tak terbaca, dan QR yang rusak", async () => {
    await expect(
      normalizeAndDecodeQris(Buffer.from("not image"), "image/png"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    const blank = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeAndDecodeQris(blank, "image/png"),
    ).rejects.toMatchObject({ code: "QR_UNREADABLE" });
    const source = await QRCode.toBuffer(payload, { type: "png", width: 600 });
    await expect(
      renderQrisDesign(source, design, hashValue("different")),
    ).rejects.toMatchObject({ code: "QR_SOURCE_INVALID" });
  });

  it("persetujuan kontak dan koordinat lengkap divalidasi", () => {
    const data = {
      sessionId: "abc",
      token: "x".repeat(32),
      requestId: crypto.randomUUID(),
      contactName: "Kontak Samaran",
      businessName: "Toko Samaran",
      phone: "081234567890",
      businessCategory: "Toko",
      address: "Mangga Besar",
      latitude: 0,
      longitude: 0,
      locationSource: "MAP_PIN",
      processingConsent: true,
      contactConsent: false,
      interestedProduct: "QRIS",
      bankRelationship: "UNKNOWN",
      contactWindow: null,
      needNote: null,
    };
    expect(publicQrisContactSchema.safeParse(data).success).toBe(true);
    expect(
      publicQrisContactSchema.safeParse({ ...data, longitude: null }).success,
    ).toBe(false);
    expect(
      publicQrisContactSchema.safeParse({ ...data, processingConsent: false })
        .success,
    ).toBe(false);
  });
});
