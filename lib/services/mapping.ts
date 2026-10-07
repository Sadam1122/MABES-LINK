import { OpportunityStage } from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { mappingProspectScope, requireBranch } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createAssignmentNotification } from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import { makeCode } from "@/lib/utils";
import type {
  mappingLocationCreateSchema,
  mappingLocationPatchSchema,
} from "@/lib/validation";

type LocationPatch = z.infer<typeof mappingLocationPatchSchema>;
type LocationCreate = z.infer<typeof mappingLocationCreateSchema>;

export async function createMappingLocation(
  actor: Actor,
  input: LocationCreate,
  requestId?: string | null,
) {
  const assignee = await db.user.findFirst({
    where: {
      id: input.assignedToId,
      active: true,
      isTest: false,
      branchId: actor.role === "ADMIN" ? { not: null } : requireBranch(actor),
    },
    select: { id: true, branchId: true },
  });
  if (!assignee?.branchId)
    throw new AppError(
      "PIC tidak aktif, tidak memiliki cabang, atau berada di luar cakupan Anda.",
      422,
      "INVALID_ASSIGNEE",
    );
  const branchId = assignee.branchId;

  return db.$transaction(async (tx) => {
    const prospect = await tx.prospect.create({
      data: {
        internalCode: makeCode("PR-11539"),
        businessAlias: input.businessAlias,
        need: "Belum dikonfirmasi",
        contactPic: input.contactPic ?? "Tidak dicantumkan",
        areaBlock: input.areaBlock,
        businessSector: input.businessSector,
        addressHint: input.addressHint,
        latitude: input.latitude,
        longitude: input.longitude,
        productNeeds: input.productNeeds,
        locationLabel: input.locationLabel,
        locationSource: input.locationSource,
        locationUpdatedAt: input.latitude == null ? null : new Date(),
        mappingMarkerIcon: input.mappingMarkerIcon,
        opportunityStage: OpportunityStage.NEW,
        branchId,
        assignedToId: assignee.id,
        createdById: actor.id,
      },
    });
    await tx.mappingDiscovery.create({ data: { prospectId: prospect.id, sourceType: "UNKNOWN" } });
    await createAssignmentNotification(tx, {
      recipientId: prospect.assignedToId,
      branchId: prospect.branchId,
      type: "SERVICE_STATUS",
      title: "Lokasi mapping ditambahkan",
      message: `${prospect.internalCode} telah ditambahkan ke mapping operasional.`,
      link: "/mapping",
      dedupKey: `mapping-created:${prospect.id}`,
    });
    await writeAudit(tx, actor, {
      entityType: "Prospect",
      entityId: prospect.id,
      action: "MAPPING_LOCATION_CREATED",
      branchId: prospect.branchId,
      after: {
        internalCode: prospect.internalCode,
        assignedToId: prospect.assignedToId,
        latitude: prospect.latitude,
        longitude: prospect.longitude,
        mappingMarkerIcon: prospect.mappingMarkerIcon,
        usageVerified: false,
      },
      requestId,
    });
    return prospect;
  });
}

export async function updateMappingLocation(
  actor: Actor,
  id: string,
  input: LocationPatch,
  requestId?: string | null,
) {
  const current = await db.prospect.findFirst({
    where: { id, AND: [mappingProspectScope(actor)] },
  });
  if (!current)
    throw new AppError(
      "Lokasi tidak ditemukan atau berada di luar cabang Anda.",
      404,
      "NOT_FOUND",
    );

  return db.$transaction(async (tx) => {
    const result = await tx.prospect.updateMany({
      where: { id, version: input.version },
      data: {
        latitude: input.latitude,
        longitude: input.longitude,
        locationLabel: input.locationLabel,
        locationSource: input.locationSource,
        mappingMarkerIcon: input.mappingMarkerIcon,
        locationUpdatedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Mapping telah diubah pengguna lain. Muat ulang lalu coba lagi.",
        409,
        "VERSION_CONFLICT",
      );
    const updated = await tx.prospect.findUniqueOrThrow({ where: { id } });
    await createAssignmentNotification(tx, {
      recipientId: updated.assignedToId,
      branchId: updated.branchId,
      type: "SERVICE_STATUS",
      title: "Mapping lokasi diperbarui",
      message: `${updated.internalCode} memiliki perubahan lokasi oleh petugas cabang.`,
      link: "/mapping",
      dedupKey: `mapping-location:${updated.id}:v${updated.version}`,
    });
    await writeAudit(tx, actor, {
      entityType: "Prospect",
      entityId: id,
      action: "MAPPING_LOCATION_UPDATED",
      branchId: updated.branchId,
      before: {
        latitude: current.latitude,
        longitude: current.longitude,
        locationLabel: current.locationLabel,
        locationSource: current.locationSource,
        mappingMarkerIcon: current.mappingMarkerIcon,
      },
      after: {
        latitude: updated.latitude,
        longitude: updated.longitude,
        locationLabel: updated.locationLabel,
        locationSource: updated.locationSource,
        mappingMarkerIcon: updated.mappingMarkerIcon,
      },
      requestId,
    });
    return updated;
  });
}
