import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";
import sharp from "sharp";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { privateStorageRoot } from "@/lib/services/location-photos";

const maxUploadBytes = 8 * 1024 * 1024;
const expiryHours = 24;

export function qrisStorageRoot() {
  return path.resolve(privateStorageRoot(), "qris-custom-temp");
}

function pathForKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+\.png$/.test(key))
    throw new AppError("Kunci file tidak valid.", 400, "INVALID_FILE_KEY");
  return path.join(qrisStorageRoot(), key);
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkPublicRateLimit(
  request: Request,
  action: string,
  maxCount: number,
) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL;
  if (origin && appUrl && origin !== new URL(appUrl).origin)
    throw new AppError(
      "Asal permintaan tidak diizinkan.",
      403,
      "ORIGIN_FORBIDDEN",
    );
  // Header IP hanya dipercaya jika aplikasi berada di belakang proxy internal
  // yang menghapus/mengisi ulang header dari klien. Default memakai bucket global.
  const forwarded =
    process.env.PUBLIC_RATE_LIMIT_TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      : null;
  const source = forwarded || "untrusted-network";
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new AppError("Konfigurasi server belum lengkap.", 503);
  const key = hashValue(`${secret}:${action}:${source}`);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60_000);
  const result = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "PublicRateLimit" ("key", "count", "windowEnd", "updatedAt")
    VALUES (${key}, 1, ${windowEnd}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "PublicRateLimit"."windowEnd" < ${now} THEN 1 ELSE "PublicRateLimit"."count" + 1 END,
      "windowEnd" = CASE WHEN "PublicRateLimit"."windowEnd" < ${now} THEN ${windowEnd} ELSE "PublicRateLimit"."windowEnd" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `;
  if ((result[0]?.count ?? 0) > maxCount)
    throw new AppError(
      "Terlalu banyak percobaan. Coba lagi nanti.",
      429,
      "RATE_LIMITED",
    );
}

async function rasterizePdf(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new AppError("Isi PDF tidak valid.", 422, "INVALID_PDF");
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: false,
      stopAtErrors: true,
    });
    const document = await loading.promise;
    try {
      if (document.numPages !== 1)
        throw new AppError("PDF harus satu halaman.", 422, "PDF_PAGE_COUNT");
      const page = await document.getPage(1);
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min(
        2,
        1600 / Math.max(original.width, original.height),
      );
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");
      await page.render({
        canvasContext: context as never,
        canvas: canvas as never,
        viewport,
        background: "#ffffff",
      }).promise;
      return Buffer.from(await canvas.encode("png"));
    } finally {
      await loading.destroy();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PDF tidak dapat dibuka sebagai QRIS satu halaman.",
      422,
      "INVALID_PDF",
    );
  }
}

export async function normalizeAndDecodeQris(buffer: Buffer, mimeType: string) {
  if (!buffer.length || buffer.length > maxUploadBytes)
    throw new AppError(
      "File harus lebih kecil dari 8 MB.",
      422,
      "FILE_TOO_LARGE",
    );
  if (!["image/jpeg", "image/png", "application/pdf"].includes(mimeType))
    throw new AppError("Gunakan JPG, PNG, atau PDF.", 422, "INVALID_TYPE");
  const input =
    mimeType === "application/pdf" ? await rasterizePdf(buffer) : buffer;
  let metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: 12_000_000,
    }).metadata();
  } catch {
    throw new AppError("Isi gambar tidak valid.", 422, "INVALID_IMAGE");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 180 ||
    metadata.height < 180 ||
    metadata.width > 4000 ||
    metadata.height > 4000
  )
    throw new AppError(
      "Dimensi QRIS harus 180–4000 piksel.",
      422,
      "INVALID_DIMENSIONS",
    );
  if (metadata.format !== "jpeg" && metadata.format !== "png")
    throw new AppError(
      "Isi file tidak sesuai JPG/PNG/PDF.",
      422,
      "INVALID_FORMAT",
    );
  if (mimeType === "image/jpeg" && metadata.format !== "jpeg")
    throw new AppError(
      "Tipe gambar dan isi file berbeda.",
      422,
      "MIME_MISMATCH",
    );
  if (mimeType === "image/png" && metadata.format !== "png")
    throw new AppError(
      "Tipe gambar dan isi file berbeda.",
      422,
      "MIME_MISMATCH",
    );
  const normalized = await sharp(input).rotate().png().toBuffer();
  const decoded = await decodeQris(normalized);
  if (!decoded)
    throw new AppError(
      "Kode QR tidak terbaca. Unggah ulang gambar yang jelas dan utuh.",
      422,
      "QR_UNREADABLE",
    );
  return {
    data: normalized,
    width: metadata.width,
    height: metadata.height,
    qrDigest: hashValue(decoded),
  };
}

export async function decodeQris(input: Buffer) {
  const { data, info } = await sharp(input)
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: "attemptBoth",
  });
  return image?.data || null;
}

export async function createQrisSession(buffer: Buffer, mimeType: string, publicRequestId?: string) {
  const normalized = await normalizeAndDecodeQris(buffer, mimeType);
  const token = randomBytes(32).toString("base64url");
  const key = `${randomBytes(16).toString("hex")}.png`;
  const target = pathForKey(key);
  await mkdir(qrisStorageRoot(), { recursive: true });
  await writeFile(target, normalized.data, { flag: "wx" });
  try {
    const session = await db.qrisDesignSession.create({
      data: {
        tokenHash: hashValue(token),
        storageKey: key,
        mimeType: "image/png",
        width: normalized.width,
        height: normalized.height,
        qrDigest: normalized.qrDigest,
        publicRequestId,
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60_000),
      },
    });
    return {
      id: session.id,
      token,
      expiresAt: session.expiresAt.toISOString(),
    };
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}

export async function loadQrisSession(id: string, token: string) {
  if (!id || !token || id.length > 80 || token.length > 100)
    throw new AppError("Sesi desain tidak valid.", 404, "SESSION_NOT_FOUND");
  const session = await db.qrisDesignSession.findUnique({ where: { id } });
  const digest = hashValue(token);
  if (
    !session ||
    session.expiresAt < new Date() ||
    !timingSafeEqual(Buffer.from(session.tokenHash), Buffer.from(digest))
  )
    throw new AppError(
      "Sesi desain kedaluwarsa atau tidak ditemukan.",
      404,
      "SESSION_NOT_FOUND",
    );
  return { session, data: await readFile(pathForKey(session.storageKey)) };
}

export async function deleteQrisSession(id: string, token: string) {
  const { session } = await loadQrisSession(id, token);
  await db.qrisDesignSession.delete({ where: { id } });
  await rm(pathForKey(session.storageKey), { force: true });
}
