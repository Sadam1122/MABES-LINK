import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "@prisma/client";
import sharp from "sharp";
import { writeAudit } from "@/lib/audit";
import { mappingProspectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createAssignmentNotification } from "@/lib/notifications";
import type { Actor } from "@/lib/session";

const allowedFormats = new Set(["jpeg", "png", "webp"]);
const editableRoles: Role[] = [
  Role.OUT_BRANCH,
  Role.CS,
  Role.SUPERVISOR,
  Role.ADMIN,
];

export function privateStorageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.PRIVATE_STORAGE_PATH ??
      path.join(process.cwd(), ".data", "private-uploads"),
  );
}

function storagePath(key: string) {
  const root = privateStorageRoot();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`))
    throw new AppError("Storage key tidak valid.", 400, "INVALID_STORAGE_KEY");
  return resolved;
}

export async function validateAndEncodeLocationImage(input: Buffer) {
  const maxBytes = Number(
    process.env.LOCATION_PHOTO_MAX_BYTES ?? 5 * 1024 * 1024,
  );
  const maxDimension = Number(process.env.LOCATION_PHOTO_MAX_DIMENSION ?? 8000);
  if (!input.length || input.length > maxBytes)
    throw new AppError(
      "Ukuran gambar melebihi batas 5 MB.",
      422,
      "FILE_TOO_LARGE",
    );
  let metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: maxDimension * maxDimension,
    }).metadata();
  } catch {
    throw new AppError(
      "Isi file bukan gambar yang valid.",
      422,
      "INVALID_IMAGE",
    );
  }
  if (!metadata.format || !allowedFormats.has(metadata.format))
    throw new AppError(
      "Hanya JPEG, PNG, atau WebP yang diizinkan.",
      422,
      "INVALID_IMAGE_TYPE",
    );
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > maxDimension ||
    metadata.height > maxDimension
  )
    throw new AppError(
      "Dimensi gambar tidak valid atau terlalu besar.",
      422,
      "INVALID_IMAGE_DIMENSION",
    );
  const output = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return {
    data: output.data,
    mimeType: "image/webp",
    width: output.info.width,
    height: output.info.height,
    checksum: createHash("sha256").update(output.data).digest("hex"),
  };
}

export async function addLocationPhoto(
  actor: Actor,
  prospectId: string,
  file: File,
  requestId?: string | null,
) {
  if (!editableRoles.includes(actor.role))
    throw new AppError(
      "Anda tidak berwenang mengubah foto lokasi.",
      403,
      "FORBIDDEN",
    );
  const prospect = await db.prospect.findFirst({
    where: { id: prospectId, AND: [mappingProspectScope(actor)] },
    include: { _count: { select: { locationPhotos: true } } },
  });
  if (!prospect)
    throw new AppError("Lokasi tidak ditemukan.", 404, "NOT_FOUND");
  const maxFiles = Number(process.env.LOCATION_PHOTO_MAX_FILES ?? 3);
  if (prospect._count.locationPhotos >= maxFiles)
    throw new AppError(
      `Maksimum ${maxFiles} gambar per lokasi.`,
      422,
      "PHOTO_LIMIT",
    );
  const encoded = await validateAndEncodeLocationImage(
    Buffer.from(await file.arrayBuffer()),
  );
  const key = `${prospect.id}/${randomUUID()}.webp`;
  const target = storagePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, encoded.data, { flag: "wx" });
  try {
    return await db.$transaction(async (tx) => {
      const photo = await tx.locationPhoto.create({
        data: {
          prospectId,
          storageKey: key,
          mimeType: encoded.mimeType,
          byteSize: encoded.data.length,
          width: encoded.width,
          height: encoded.height,
          checksum: encoded.checksum,
          createdById: actor.id,
        },
      });
      await writeAudit(tx, actor, {
        entityType: "LocationPhoto",
        entityId: photo.id,
        action: "LOCATION_PHOTO_ADDED",
        branchId: prospect.branchId,
        after: {
          prospectId,
          mimeType: photo.mimeType,
          byteSize: photo.byteSize,
          width: photo.width,
          height: photo.height,
        },
        requestId,
      });
      await createAssignmentNotification(tx, {
        recipientId: prospect.assignedToId,
        branchId: prospect.branchId,
        type: "SERVICE_STATUS",
        title: "Foto mapping ditambahkan",
        message: `${prospect.internalCode} memiliki foto lokasi baru.`,
        link: "/mapping",
        dedupKey: `location-photo-added:${photo.id}`,
      });
      return photo;
    });
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}

export async function getLocationPhoto(actor: Actor, id: string) {
  const photo = await db.locationPhoto.findFirst({
    where: { id, prospect: mappingProspectScope(actor) },
  });
  if (!photo) throw new AppError("Gambar tidak ditemukan.", 404, "NOT_FOUND");
  try {
    return {
      photo,
      data: await readFile(
        /* turbopackIgnore: true */ storagePath(photo.storageKey),
      ),
    };
  } catch {
    throw new AppError(
      "File gambar tidak tersedia pada storage.",
      503,
      "STORAGE_UNAVAILABLE",
    );
  }
}

export async function deleteLocationPhoto(
  actor: Actor,
  id: string,
  requestId?: string | null,
) {
  if (!editableRoles.includes(actor.role))
    throw new AppError(
      "Anda tidak berwenang menghapus foto lokasi.",
      403,
      "FORBIDDEN",
    );
  const photo = await db.locationPhoto.findFirst({
    where: { id, prospect: mappingProspectScope(actor) },
    include: {
      prospect: {
        select: { branchId: true, assignedToId: true, internalCode: true },
      },
    },
  });
  if (!photo) throw new AppError("Gambar tidak ditemukan.", 404, "NOT_FOUND");
  await db.$transaction(async (tx) => {
    await writeAudit(tx, actor, {
      entityType: "LocationPhoto",
      entityId: id,
      action: "LOCATION_PHOTO_DELETED",
      branchId: photo.prospect.branchId,
      before: { prospectId: photo.prospectId, storageKey: photo.storageKey },
      requestId,
    });
    await tx.locationPhoto.delete({ where: { id } });
    await createAssignmentNotification(tx, {
      recipientId: photo.prospect.assignedToId,
      branchId: photo.prospect.branchId,
      type: "SERVICE_STATUS",
      title: "Foto mapping dihapus",
      message: `${photo.prospect.internalCode} memiliki perubahan foto lokasi.`,
      link: "/mapping",
      dedupKey: `location-photo-deleted:${id}:${photo.checksum}`,
    });
  });
  await rm(storagePath(photo.storageKey), { force: true });
}

export async function replaceLocationPhoto(
  actor: Actor,
  id: string,
  file: File,
  requestId?: string | null,
) {
  if (!editableRoles.includes(actor.role))
    throw new AppError(
      "Anda tidak berwenang mengganti foto lokasi.",
      403,
      "FORBIDDEN",
    );
  const current = await db.locationPhoto.findFirst({
    where: { id, prospect: mappingProspectScope(actor) },
    include: {
      prospect: {
        select: {
          id: true,
          branchId: true,
          assignedToId: true,
          internalCode: true,
        },
      },
    },
  });
  if (!current) throw new AppError("Gambar tidak ditemukan.", 404, "NOT_FOUND");
  const encoded = await validateAndEncodeLocationImage(
    Buffer.from(await file.arrayBuffer()),
  );
  const nextKey = `${current.prospect.id}/${randomUUID()}.webp`;
  const nextTarget = storagePath(nextKey);
  await mkdir(path.dirname(nextTarget), { recursive: true });
  await writeFile(nextTarget, encoded.data, { flag: "wx" });
  try {
    const updated = await db.$transaction(async (tx) => {
      const photo = await tx.locationPhoto.update({
        where: { id },
        data: {
          storageKey: nextKey,
          mimeType: encoded.mimeType,
          byteSize: encoded.data.length,
          width: encoded.width,
          height: encoded.height,
          checksum: encoded.checksum,
          createdById: actor.id,
        },
      });
      await writeAudit(tx, actor, {
        entityType: "LocationPhoto",
        entityId: id,
        action: "LOCATION_PHOTO_REPLACED",
        branchId: current.prospect.branchId,
        before: { storageKey: current.storageKey, checksum: current.checksum },
        after: { storageKey: nextKey, checksum: encoded.checksum },
        requestId,
      });
      await createAssignmentNotification(tx, {
        recipientId: current.prospect.assignedToId,
        branchId: current.prospect.branchId,
        type: "SERVICE_STATUS",
        title: "Foto mapping diganti",
        message: `${current.prospect.internalCode} memiliki perubahan foto lokasi.`,
        link: "/mapping",
        dedupKey: `location-photo-replaced:${id}:${encoded.checksum}`,
      });
      return photo;
    });
    await rm(storagePath(current.storageKey), { force: true });
    return updated;
  } catch (error) {
    await rm(nextTarget, { force: true });
    throw error;
  }
}
