import { OpportunityStage, Prisma, Role } from "@prisma/client";

import { writeAudit } from "@/lib/audit";
import {
  assertAllowed,
  canCreateProspect,
  prospectScope,
  requireBranch,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { makeCode } from "@/lib/utils";
import { assertProspectTransition } from "@/lib/workflow";
import type {
  paginationSchema,
  prospectCreateSchema,
  prospectPatchSchema,
} from "@/lib/validation";
import type { z } from "zod";

type PageInput = z.infer<typeof paginationSchema>;
type CreateInput = z.infer<typeof prospectCreateSchema>;
type PatchInput = z.infer<typeof prospectPatchSchema>;

export async function listProspects(actor: Actor, input: PageInput) {
  const where: Prisma.ProspectWhereInput = {
    AND: [
      prospectScope(actor),
      input.search
        ? {
            OR: [
              { internalCode: { contains: input.search, mode: "insensitive" } },
              {
                cakraReference: { contains: input.search, mode: "insensitive" },
              },
              {
                businessAlias: { contains: input.search, mode: "insensitive" },
              },
              { contactPic: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const skip = (input.page - 1) * input.pageSize;
  const [items, total] = await db.$transaction([
    db.prospect.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        _count: { select: { followUps: true, usageVerifications: true } },
        visits: { orderBy: { visitedAt: "desc" }, take: 1 },
        locationPhotos: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: input.pageSize,
    }),
    db.prospect.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      pages: Math.ceil(total / input.pageSize),
    },
  };
}

export async function getProspect(actor: Actor, id: string) {
  const prospect = await db.prospect.findFirst({
    where: { id, AND: [prospectScope(actor)] },
    include: {
      branch: true,
      assignedTo: { select: { id: true, name: true, role: true } },
      followUps: {
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { dueAt: "desc" },
      },
      handoverItems: {
        include: {
          batch: {
            include: { receiver: { select: { id: true, name: true } } },
          },
        },
      },
      usageVerifications: {
        include: { recordedBy: { select: { id: true, name: true } } },
        orderBy: { usedAt: "desc" },
      },
      visits: { orderBy: { visitedAt: "desc" } },
      locationPhotos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!prospect)
    throw new AppError(
      "Prospek tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  return prospect;
}

export async function createProspect(
  actor: Actor,
  input: CreateInput,
  requestId?: string | null,
) {
  assertAllowed(canCreateProspect(actor));
  if (process.env.ALLOW_MANUAL_REFERENCE_ENTRY !== "true")
    throw new AppError(
      "Pembuatan referensi manual dinonaktifkan. Gunakan record existing atau mekanisme resmi yang diizinkan.",
      403,
      "MANUAL_REFERENCE_DISABLED",
    );
  const branchId =
    actor.role === Role.ADMIN
      ? (actor.branchId ??
        (() => {
          throw new AppError(
            "Admin harus memiliki cabang untuk membuat prospek.",
            422,
          );
        })())
      : requireBranch(actor);
  const assignedToId = input.assignedToId ?? actor.id;
  const assignee = await db.user.findFirst({
    where: { id: assignedToId, active: true, branchId },
  });
  if (!assignee)
    throw new AppError(
      "PIC tidak aktif atau berbeda cabang.",
      422,
      "INVALID_ASSIGNEE",
    );

  return db.$transaction(async (tx) => {
    const prospect = await tx.prospect.create({
      data: {
        internalCode: makeCode("PR-11539"),
        cakraReference: input.cakraReference,
        businessAlias: input.businessAlias,
        need: input.need,
        contactPic: input.contactPic,
        branchId,
        assignedToId,
        createdById: actor.id,
        areaBlock: input.areaBlock,
        businessSector: input.businessSector,
        addressHint: input.addressHint,
        latitude: input.latitude,
        longitude: input.longitude,
        productNeeds: input.productNeeds,
        locationLabel: input.locationLabel,
        locationSource: input.locationSource,
        locationUpdatedAt:
          input.latitude !== undefined ||
          input.longitude !== undefined ||
          input.locationLabel !== undefined ||
          input.locationSource !== undefined
            ? new Date()
            : undefined,
      },
    });
    await writeAudit(tx, actor, {
      entityType: "Prospect",
      entityId: prospect.id,
      action: "PROSPECT_CREATED",
      branchId,
      after: {
        internalCode: prospect.internalCode,
        assignedToId,
        opportunityStage: prospect.opportunityStage,
      },
      requestId,
    });
    return prospect;
  });
}

export async function updateProspect(
  actor: Actor,
  id: string,
  input: PatchInput,
  requestId?: string | null,
) {
  assertAllowed(canCreateProspect(actor));
  const current = await db.prospect.findFirst({
    where: { id, AND: [prospectScope(actor)] },
  });
  if (!current)
    throw new AppError(
      "Prospek tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  if (actor.role === Role.OUT_BRANCH) {
    if (input.assignedToId && input.assignedToId !== actor.id)
      throw new AppError(
        "Perubahan PIC ke petugas lain memerlukan supervisor.",
        403,
        "FORBIDDEN",
      );
    if (
      input.opportunityStage &&
      !(
        [
          OpportunityStage.NEED_CONFIRMED,
          OpportunityStage.CLOSED_LOST,
        ] as OpportunityStage[]
      ).includes(input.opportunityStage)
    )
      throw new AppError(
        "Tahap berikutnya dikelola oleh alur follow-up dan handover.",
        403,
        "FORBIDDEN",
      );
  }
  if (input.opportunityStage)
    assertProspectTransition(current.opportunityStage, input.opportunityStage);
  if (input.assignedToId) {
    const assignee = await db.user.findFirst({
      where: {
        id: input.assignedToId,
        branchId: current.branchId,
        active: true,
      },
    });
    if (!assignee)
      throw new AppError(
        "PIC tidak aktif atau berbeda cabang.",
        422,
        "INVALID_ASSIGNEE",
      );
  }

  return db.$transaction(async (tx) => {
    const result = await tx.prospect.updateMany({
      where: { id, version: input.version },
      data: {
        opportunityStage: input.opportunityStage,
        assignedToId: input.assignedToId,
        need: input.need,
        contactPic: input.contactPic,
        areaBlock: input.areaBlock,
        businessSector: input.businessSector,
        addressHint: input.addressHint,
        latitude: input.latitude,
        longitude: input.longitude,
        productNeeds: input.productNeeds,
        locationLabel: input.locationLabel,
        locationSource: input.locationSource,
        locationUpdatedAt:
          input.latitude !== undefined ||
          input.longitude !== undefined ||
          input.locationLabel !== undefined ||
          input.locationSource !== undefined
            ? new Date()
            : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Data telah diubah pengguna lain. Muat ulang lalu coba lagi.",
        409,
        "VERSION_CONFLICT",
      );
    const updated = await tx.prospect.findUniqueOrThrow({ where: { id } });
    await writeAudit(tx, actor, {
      entityType: "Prospect",
      entityId: id,
      action: "PROSPECT_UPDATED",
      branchId: current.branchId,
      before: {
        assignedToId: current.assignedToId,
        stage: current.opportunityStage,
        need: current.need,
      },
      after: {
        assignedToId: updated.assignedToId,
        stage: updated.opportunityStage,
        need: updated.need,
      },
      requestId,
    });
    return updated;
  });
}
