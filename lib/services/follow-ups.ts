import { FollowUpStatus, OpportunityStage, Prisma, Role } from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { followUpScope, prospectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import {
  cancelFollowUpJobs,
  createAssignmentNotification,
  scheduleFollowUpJobs,
} from "@/lib/notifications";
import type {
  followUpCreateSchema,
  followUpPatchSchema,
  paginationSchema,
} from "@/lib/validation";

type PageInput = z.infer<typeof paginationSchema> & {
  assignedToId?: string;
  due?: "overdue" | "today" | "upcoming";
  status?: FollowUpStatus;
  held?: boolean;
};
type CreateInput = z.infer<typeof followUpCreateSchema>;
type PatchInput = z.infer<typeof followUpPatchSchema>;

export async function listFollowUps(actor: Actor, input: PageInput) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const where: Prisma.FollowUpWhereInput = {
    AND: [
      followUpScope(actor),
      input.assignedToId ? { assignedToId: input.assignedToId } : {},
      input.status ? { status: input.status } : {},
      input.held
        ? {
            prospect: {
              handoverItems: {
                some: { batch: { status: "ON_HOLD" } },
              },
            },
          }
        : {},
      input.due === "overdue"
        ? { dueAt: { lt: now }, status: FollowUpStatus.PLANNED }
        : {},
      input.due === "today" ? { dueAt: { gte: now, lt: tomorrow } } : {},
      input.due === "upcoming"
        ? { dueAt: { gte: tomorrow }, status: FollowUpStatus.PLANNED }
        : {},
      input.search
        ? {
            OR: [
              { summary: { contains: input.search, mode: "insensitive" } },
              { nextAction: { contains: input.search, mode: "insensitive" } },
              {
                prospect: {
                  businessAlias: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {},
    ],
  };
  const skip = (input.page - 1) * input.pageSize;
  const items = await db.followUp.findMany({
      where,
      include: {
        prospect: true,
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      skip,
      take: input.pageSize,
  });
  const total = await db.followUp.count({ where });
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

export async function createFollowUp(
  actor: Actor,
  input: CreateInput,
  requestId?: string | null,
) {
  const prospect = await db.prospect.findFirst({
    where: { id: input.prospectId, AND: [prospectScope(actor)] },
  });
  if (!prospect)
    throw new AppError(
      "Prospek tidak ditemukan atau tidak dapat diakses.",
      404,
      "NOT_FOUND",
    );
  if (
    !(
      [
        OpportunityStage.NEED_CONFIRMED,
        OpportunityStage.FOLLOW_UP,
      ] as OpportunityStage[]
    ).includes(prospect.opportunityStage)
  ) {
    throw new AppError(
      "Konfirmasi kebutuhan sebelum membuat tindak lanjut.",
      422,
      "NEED_NOT_CONFIRMED",
    );
  }
  const assignedToId = input.assignedToId ?? actor.id;
  const assignee = await db.user.findFirst({
    where: { id: assignedToId, branchId: prospect.branchId, active: true },
  });
  if (!assignee)
    throw new AppError(
      "PIC tidak aktif atau berbeda cabang.",
      422,
      "INVALID_ASSIGNEE",
    );
  if (
    actor.role !== Role.ADMIN &&
    actor.role !== Role.SUPERVISOR &&
    assignedToId !== actor.id
  ) {
    throw new AppError(
      "Petugas hanya dapat membuat pekerjaan untuk dirinya sendiri.",
      403,
      "FORBIDDEN",
    );
  }

  return db.$transaction(async (tx) => {
    const followUp = await tx.followUp.create({
      data: { ...input, assignedToId },
    });
    if (prospect.opportunityStage === OpportunityStage.NEED_CONFIRMED) {
      await tx.prospect.update({
        where: { id: prospect.id },
        data: {
          opportunityStage: OpportunityStage.FOLLOW_UP,
          version: { increment: 1 },
        },
      });
    }
    await writeAudit(tx, actor, {
      entityType: "FollowUp",
      entityId: followUp.id,
      action: "FOLLOW_UP_CREATED",
      branchId: prospect.branchId,
      after: {
        assignedToId,
        dueAt: input.dueAt.toISOString(),
        status: followUp.status,
      },
      requestId,
    });
    await scheduleFollowUpJobs(tx, followUp, prospect.branchId);
    await createAssignmentNotification(tx, {
      recipientId: assignedToId,
      branchId: prospect.branchId,
      type: "PIC_ASSIGNMENT",
      title: "Tindak lanjut baru",
      message: `${prospect.internalCode} ditugaskan kepada Anda.`,
      link: `/follow-ups?task=${followUp.id}`,
      dedupKey: `followup-assignment:${followUp.id}:v${followUp.version}`,
      followUpId: followUp.id,
    });
    return followUp;
  });
}

export async function updateFollowUp(
  actor: Actor,
  id: string,
  input: PatchInput,
  requestId?: string | null,
) {
  const current = await db.followUp.findFirst({
    where: { id, AND: [followUpScope(actor)] },
    include: { prospect: true },
  });
  if (!current)
    throw new AppError(
      "Tindak lanjut tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  if (
    current.status !== FollowUpStatus.PLANNED &&
    input.status &&
    input.status !== current.status
  ) {
    throw new AppError(
      "Tindak lanjut yang sudah selesai/dibatalkan tidak dapat dibuka kembali.",
      422,
      "INVALID_TRANSITION",
    );
  }
  if (input.assignedToId) {
    const assignee = await db.user.findFirst({
      where: {
        id: input.assignedToId,
        branchId: current.prospect.branchId,
        active: true,
      },
    });
    if (!assignee)
      throw new AppError(
        "PIC tidak aktif atau berbeda cabang.",
        422,
        "INVALID_ASSIGNEE",
      );
    if (
      !([Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(actor.role) &&
      input.assignedToId !== actor.id
    )
      throw new AppError(
        "Perubahan PIC memerlukan supervisor.",
        403,
        "FORBIDDEN",
      );
  }
  return db.$transaction(async (tx) => {
    const result = await tx.followUp.updateMany({
      where: { id, version: input.version },
      data: {
        status: input.status,
        assignedToId: input.assignedToId,
        nextAction: input.nextAction,
        dueAt: input.dueAt,
        completedAt:
          input.status === FollowUpStatus.COMPLETED ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Data telah diubah pengguna lain. Muat ulang lalu coba lagi.",
        409,
        "VERSION_CONFLICT",
      );
    const updated = await tx.followUp.findUniqueOrThrow({ where: { id } });
    if (updated.status === FollowUpStatus.PLANNED) {
      await scheduleFollowUpJobs(tx, updated, current.prospect.branchId);
      if (updated.assignedToId !== current.assignedToId) {
        await createAssignmentNotification(tx, {
          recipientId: updated.assignedToId,
          branchId: current.prospect.branchId,
          type: "PIC_ASSIGNMENT",
          title: "PIC tindak lanjut diubah",
          message: `${current.prospect.internalCode} kini menjadi tanggung jawab Anda.`,
          link: `/follow-ups?task=${id}`,
          dedupKey: `followup-assignment:${id}:v${updated.version}`,
          followUpId: id,
        });
      }
    } else {
      await cancelFollowUpJobs(
        tx,
        id,
        "Tindak lanjut selesai atau dibatalkan.",
      );
    }
    await writeAudit(tx, actor, {
      entityType: "FollowUp",
      entityId: id,
      action: "FOLLOW_UP_UPDATED",
      branchId: current.prospect.branchId,
      before: {
        assignedToId: current.assignedToId,
        dueAt: current.dueAt.toISOString(),
        status: current.status,
      },
      after: {
        assignedToId: updated.assignedToId,
        dueAt: updated.dueAt.toISOString(),
        status: updated.status,
      },
      requestId,
    });
    return updated;
  });
}
