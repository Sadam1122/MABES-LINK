import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "@prisma/client";
import sharp from "sharp";

import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { privateStorageRoot } from "@/lib/services/location-photos";
import type { Actor } from "@/lib/session";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ACTIVE_BANNERS = 6;
const allowedFormats = new Set(["jpeg", "png", "webp"]);
const bannerDirectory = path.join(privateStorageRoot(), "home-banners");

function bannerPath(key: string) {
  if (!/^home-banners\/[0-9a-f-]{36}\.webp$/.test(key))
    throw new AppError("Kunci banner tidak valid.", 400, "INVALID_STORAGE_KEY");
  return path.join(privateStorageRoot(), key);
}

async function branchForBanner(actor: Actor) {
  if (!actor.branchId) throw new AppError("Akun belum memiliki cabang.", 403, "NO_BRANCH");
  const branch = await db.branch.findUnique({ where: { id: actor.branchId }, select: { id: true, code: true } });
  if (!branch || branch.code !== "11539")
    throw new AppError("Banner beranda hanya dikelola petugas cabang 11539.", 403, "FORBIDDEN");
  return branch;
}

export async function listHomeBanners() {
  const branch = await db.branch.findUnique({ where: { code: "11539" }, select: { id: true } });
  if (!branch) return [];
  return db.homeBanner.findMany({ where: { branchId: branch.id, active: true },
    select: { id: true, title: true, description: true, width: true, height: true,
      createdById: true, createdAt: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6 });
}

export async function uploadHomeBanner(actor: Actor, input: { title: string; description?: string; file: File }, requestId?: string | null) {
  const branch = await branchForBanner(actor);
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  if (title.length < 3 || title.length > 120 || (description && description.length > 240))
    throw new AppError("Judul 3–120 karakter dan deskripsi maksimal 240 karakter.", 422, "INVALID_BANNER_TEXT");
  if (!input.file.size || input.file.size > MAX_UPLOAD_BYTES)
    throw new AppError("Gambar banner maksimal 5 MB.", 422, "FILE_TOO_LARGE");
  if (input.file.type && !["image/jpeg", "image/png", "image/webp"].includes(input.file.type))
    throw new AppError("Gunakan JPEG, PNG, atau WebP.", 422, "INVALID_IMAGE_TYPE");
  const bytes = Buffer.from(await input.file.arrayBuffer());
  let metadata: { format?: string; width?: number; height?: number };
  try {
    metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 30_000_000 }).metadata();
  } catch {
    throw new AppError("Isi file bukan gambar yang dapat dibaca.", 422, "INVALID_IMAGE");
  }
  if (!metadata.format || !allowedFormats.has(metadata.format) || !metadata.width || !metadata.height ||
    metadata.width > 6000 || metadata.height > 6000 || metadata.width < 800 || metadata.height < 280 ||
    metadata.width / metadata.height < 1.6 || metadata.width / metadata.height > 4)
    throw new AppError("Gunakan gambar landscape minimal 800×280 px, rasio 1,6:1 sampai 4:1. Rekomendasi 1600×600 px.", 422, "INVALID_BANNER_SIZE");
  const output = await sharp(bytes, { failOn: "error" }).rotate().resize({
    width: 1920, height: 960, fit: "inside", withoutEnlargement: true,
  }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const key = `home-banners/${randomUUID()}.webp`;
  const target = bannerPath(key);
  await mkdir(bannerDirectory, { recursive: true });
  await writeFile(target, output.data, { flag: "wx" });
  try {
    const banner = await db.$transaction(async (tx) => {
      const active = await tx.homeBanner.count({ where: { branchId: branch.id, active: true } });
      if (active >= MAX_ACTIVE_BANNERS)
        throw new AppError(`Maksimal ${MAX_ACTIVE_BANNERS} banner aktif. Hapus banner lama sebelum mengunggah.`, 422, "BANNER_LIMIT");
      const created = await tx.homeBanner.create({ data: { title, description,
        storageKey: key, mimeType: "image/webp", byteSize: output.data.length,
        width: output.info.width, height: output.info.height,
        checksum: createHash("sha256").update(output.data).digest("hex"),
        branchId: branch.id, createdById: actor.id } });
      await writeAudit(tx, actor, { entityType: "HomeBanner", entityId: created.id, branchId: branch.id,
        action: "HOME_BANNER_CREATED", after: { title, width: created.width, height: created.height }, requestId });
      return created;
    }, { isolationLevel: "Serializable" });
    return { id: banner.id, title: banner.title };
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}

export async function deleteHomeBanner(actor: Actor, id: string, requestId?: string | null) {
  const branch = await branchForBanner(actor);
  const banner = await db.homeBanner.findFirst({ where: { id, branchId: branch.id } });
  if (!banner) throw new AppError("Banner tidak ditemukan.", 404, "NOT_FOUND");
  if (banner.createdById !== actor.id && actor.role !== Role.ADMIN && actor.role !== Role.SUPERVISOR)
    throw new AppError("Anda hanya dapat menghapus banner yang Anda unggah.", 403, "FORBIDDEN");
  await db.$transaction(async (tx) => {
    await tx.homeBanner.delete({ where: { id: banner.id } });
    await writeAudit(tx, actor, { entityType: "HomeBanner", entityId: banner.id, branchId: branch.id,
      action: "HOME_BANNER_DELETED", before: { title: banner.title, checksum: banner.checksum }, requestId });
  });
  await rm(bannerPath(banner.storageKey), { force: true });
}

export async function readPublicHomeBanner(id: string) {
  const banner = await db.homeBanner.findFirst({ where: { id, active: true, branch: { code: "11539" } },
    select: { storageKey: true, mimeType: true } });
  if (!banner) throw new AppError("Banner tidak ditemukan.", 404, "NOT_FOUND");
  try {
    return { data: await readFile(bannerPath(banner.storageKey)), mimeType: banner.mimeType };
  } catch {
    throw new AppError("Gambar banner tidak tersedia.", 503, "STORAGE_UNAVAILABLE");
  }
}
