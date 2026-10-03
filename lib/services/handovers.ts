import {
  ExceptionStatus,
  HandoverStatus,
  OpportunityStage,
  Role,
} from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import {
  assertAllowed,
  canTransitionHandover,
  handoverScope,
  prospectScope,
  requireBranch,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { makeCode } from "@/lib/utils";
import { createAssignmentNotification } from "@/lib/notifications";
import type {
  exceptionCreateSchema,
  exceptionPatchSchema,
  handoverCreateSchema,
  handoverPatchSchema,
  paginationSchema,
} from "@/lib/validation";
import {
  assertExceptionTransition,
  assertHandoverTransition,
  assertReadyRequirements,
} from "@/lib/workflow";

type PageInput = z.infer<typeof paginationSchema> & { status?: HandoverStatus };
type CreateInput = z.infer<typeof handoverCreateSchema>;
type PatchInput = z.infer<typeof handoverPatchSchema>;
type ExceptionInput = z.infer<typeof exceptionCreateSchema>;
type ExceptionPatchInput = z.infer<typeof exceptionPatchSchema>;

const handoverInclude = {
  sender: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  items: {
    include: {
      prospect: {
        include: {
          usageVerifications: {
            where: { status: "VERIFIED" as const },
            take: 1,
          },
        },
      },
    },
  },
  exceptions: {
    include: {
      prospect: {
        select: { id: true, internalCode: true, businessAlias: true },
      },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function listHandovers(actor: Actor, input: PageInput) {
  const where = {
    AND: [
      handoverScope(actor),
      input.status ? { status: input.status } : {},
      input.search
        ? {
            OR: [
              {
                batchNumber: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
              {
                title: { contains: input.search, mode: "insensitive" as const },
              },
            ],
          }
        : {},
    ],
  };
  const skip = (input.page - 1) * input.pageSize;
  const [items, total] = await db.$transaction([
    db.handoverBatch.findMany({
      where,
      include: handoverInclude,
      orderBy: { updatedAt: "desc" },
      skip,
      take: input.pageSize,
    }),
    db.handoverBatch.count({ where }),
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

export async function getHandover(actor: Actor, id: string) {
  const batch = await db.handoverBatch.findFirst({
    where: { id, AND: [handoverScope(actor)] },
    include: handoverInclude,
  });
  if (!batch)
    throw new AppError(
      "Handover tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  return batch;
}

export async function createHandover(
  actor: Actor,
  input: CreateInput,
  requestId?: string | null,
) {
  assertAllowed(
    ([Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
      actor.role,
    ),
  );
  const branchId = requireBranch(actor);
  const receiver = await db.user.findFirst({
    where: { id: input.receiverId, branchId, role: Role.CS, active: true },
  });
  if (!receiver)
    throw new AppError(
      "Penerima harus CS aktif pada cabang yang sama.",
      422,
      "INVALID_RECEIVER",
    );
  const prospects = await db.prospect.findMany({
    where: { id: { in: input.prospectIds }, AND: [prospectScope(actor)] },
    include: { handoverItems: { select: { id: true }, take: 1 } },
  });
  if (prospects.length !== input.prospectIds.length)
    throw new AppError(
      "Ada prospek yang tidak ditemukan atau tidak dapat diakses.",
      403,
      "PROSPECT_SCOPE",
    );
  if (
    prospects.some(
      (p) =>
        !(
          [
            OpportunityStage.NEED_CONFIRMED,
            OpportunityStage.FOLLOW_UP,
          ] as OpportunityStage[]
        ).includes(p.opportunityStage),
    )
  ) {
    throw new AppError(
      "Semua kebutuhan prospek harus dikonfirmasi sebelum handover.",
      422,
      "INVALID_PROSPECT_STAGE",
    );
  }
  if (prospects.some((p) => p.handoverItems.length > 0))
    throw new AppError(
      "Prospek yang sudah memiliki handover tidak boleh dimasukkan kembali.",
      409,
      "DUPLICATE_HANDOVER",
    );
  return db.$transaction(async (tx) => {
    const batch = await tx.handoverBatch.create({
      data: {
        batchNumber: makeCode("HO-11539"),
        type: input.type,
        title: input.title,
        branchId,
        senderId: actor.id,
        receiverId: input.receiverId,
        items: {
          create: input.prospectIds.map((prospectId) => ({ prospectId })),
        },
      },
    });
    await writeAudit(tx, actor, {
      entityType: "HandoverBatch",
      entityId: batch.id,
      action: "HANDOVER_CREATED",
      branchId,
      after: {
        status: batch.status,
        receiverId: input.receiverId,
        prospectIds: input.prospectIds,
      },
      requestId,
    });
    await createAssignmentNotification(tx, {
      recipientId: input.receiverId,
      branchId,
      type: "HANDOVER_ASSIGNMENT",
      title: "Handover baru",
      message: `${batch.batchNumber} menunggu penerimaan Anda.`,
      link: `/handovers/${batch.id}`,
      dedupKey: `handover-assignment:${batch.id}:v${batch.version}`,
      handoverId: batch.id,
    });
    return batch;
  });
}

export async function updateHandover(
  actor: Actor,
  id: string,
  input: PatchInput,
  requestId?: string | null,
) {
  const current = await db.handoverBatch.findFirst({
    where: { id, AND: [handoverScope(actor)] },
    include: { items: true, exceptions: true },
  });
  if (!current)
    throw new AppError(
      "Handover tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  assertAllowed(canTransitionHandover(actor, current, input.status));
  assertHandoverTransition(current.status, input.status);
  if (input.status === HandoverStatus.READY) {
    assertReadyRequirements(
      current.exceptions.filter(
        (item) => item.status !== ExceptionStatus.RESOLVED,
      ).length,
    );
  }
  if (
    (
      [HandoverStatus.ON_HOLD, HandoverStatus.ESCALATED] as HandoverStatus[]
    ).includes(input.status) &&
    !current.exceptions.some((item) => item.status !== ExceptionStatus.RESOLVED)
  )
    throw new AppError(
      "Catat subkasus kendala nyata sebelum menahan atau mengeskalasi batch.",
      422,
      "EXCEPTION_REQUIRED",
    );
  const now = new Date();
  return db.$transaction(async (tx) => {
    const result = await tx.handoverBatch.updateMany({
      where: { id, version: input.version },
      data: {
        status: input.status,
        submittedAt:
          input.status === HandoverStatus.SUBMITTED ? now : undefined,
        acceptedAt: input.status === HandoverStatus.ACCEPTED ? now : undefined,
        readyAt: input.status === HandoverStatus.READY ? now : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Data telah diubah pengguna lain. Muat ulang lalu coba lagi.",
        409,
        "VERSION_CONFLICT",
      );
    let stage: OpportunityStage | undefined;
    if (input.status === HandoverStatus.SUBMITTED)
      stage = OpportunityStage.HANDOVER;
    if (
      (
        [
          HandoverStatus.ACCEPTED,
          HandoverStatus.PROCESSING,
          HandoverStatus.ON_HOLD,
          HandoverStatus.ESCALATED,
        ] as HandoverStatus[]
      ).includes(input.status)
    )
      stage = OpportunityStage.PROCESSING;
    if (input.status === HandoverStatus.READY) stage = OpportunityStage.READY;
    if (stage)
      await tx.prospect.updateMany({
        where: { id: { in: current.items.map((item) => item.prospectId) } },
        data: { opportunityStage: stage, version: { increment: 1 } },
      });
    const updated = await tx.handoverBatch.findUniqueOrThrow({ where: { id } });
    await writeAudit(tx, actor, {
      entityType: "HandoverBatch",
      entityId: id,
      action: `HANDOVER_${input.status}`,
      branchId: current.branchId,
      before: { status: current.status },
      after: { status: updated.status },
      requestId,
    });
    return updated;
  });
}

export async function createException(
  actor: Actor,
  batchId: string,
  input: ExceptionInput,
  requestId?: string | null,
) {
  const batch = await db.handoverBatch.findFirst({
    where: { id: batchId, AND: [handoverScope(actor)] },
    include: { items: true },
  });
  if (!batch)
    throw new AppError(
      "Handover tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  assertAllowed(
    ([Role.CS, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(actor.role),
  );
  if (
    !(
      [
        HandoverStatus.ACCEPTED,
        HandoverStatus.PROCESSING,
        HandoverStatus.ON_HOLD,
        HandoverStatus.ESCALATED,
      ] as HandoverStatus[]
    ).includes(batch.status)
  )
    throw new AppError(
      "Subkasus hanya dapat dicatat setelah handover diterima dan sebelum siap.",
      422,
      "INVALID_BATCH_STATUS",
    );
  if (
    input.prospectId &&
    !batch.items.some((item) => item.prospectId === input.prospectId)
  )
    throw new AppError(
      "Prospek bukan anggota batch ini.",
      422,
      "INVALID_BATCH_PROSPECT",
    );
  if (input.assignedToId) {
    const assignee = await db.user.findFirst({
      where: {
        id: input.assignedToId,
        branchId: batch.branchId,
        active: true,
        role: { in: [Role.CS, Role.SUPERVISOR] },
      },
    });
    if (!assignee)
      throw new AppError(
        "PIC subkasus harus petugas aktif pada cabang yang sama.",
        422,
        "INVALID_ASSIGNEE",
      );
  }
  const exception = await db.$transaction(async (tx) => {
    const created = await tx.exceptionCase.create({
      data: { ...input, batchId },
    });
    await writeAudit(tx, actor, {
      entityType: "ExceptionCase",
      entityId: created.id,
      action: "EXCEPTION_CREATED",
      branchId: batch.branchId,
      after: {
        category: created.category,
        status: created.status,
        assignedToId: created.assignedToId,
      },
      requestId,
    });
    return created;
  });
  return exception;
}

export async function updateException(
  actor: Actor,
  batchId: string,
  exceptionId: string,
  input: ExceptionPatchInput,
  requestId?: string | null,
) {
  const batch = await db.handoverBatch.findFirst({
    where: { id: batchId, AND: [handoverScope(actor)] },
  });
  if (!batch)
    throw new AppError(
      "Handover tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  assertAllowed(
    ([Role.CS, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(actor.role),
  );
  const current = await db.exceptionCase.findFirst({
    where: { id: exceptionId, batchId },
  });
  if (!current)
    throw new AppError("Subkasus tidak ditemukan.", 404, "NOT_FOUND");
  assertExceptionTransition(current.status, input.status);
  if (input.assignedToId) {
    const assignee = await db.user.findFirst({
      where: {
        id: input.assignedToId,
        branchId: batch.branchId,
        active: true,
        role: { in: [Role.CS, Role.SUPERVISOR] },
      },
    });
    if (!assignee)
      throw new AppError(
        "PIC subkasus harus petugas aktif pada cabang yang sama.",
        422,
        "INVALID_ASSIGNEE",
      );
  }
  return db.$transaction(async (tx) => {
    const result = await tx.exceptionCase.updateMany({
      where: { id: exceptionId, version: input.version },
      data: {
        status: input.status,
        assignedToId: input.assignedToId,
        resolvedAt:
          input.status === ExceptionStatus.RESOLVED ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Data telah diubah pengguna lain. Muat ulang lalu coba lagi.",
        409,
        "VERSION_CONFLICT",
      );
    const updated = await tx.exceptionCase.findUniqueOrThrow({
      where: { id: exceptionId },
    });
    await writeAudit(tx, actor, {
      entityType: "ExceptionCase",
      entityId: exceptionId,
      action: "EXCEPTION_UPDATED",
      branchId: batch.branchId,
      before: { status: current.status, assignedToId: current.assignedToId },
      after: { status: updated.status, assignedToId: updated.assignedToId },
      requestId,
    });
    return updated;
  });
}
