import {
  FollowUpStatus,
  OpportunityStage,
  Prisma,
  Role,
  VisitOutcome,
} from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import {
  assertAllowed,
  canRecordVisit,
  prospectScope,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createAssignmentNotification,
  scheduleFollowUpJobs,
} from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import type { paginationSchema, visitCreateSchema } from "@/lib/validation";

type VisitInput = z.infer<typeof visitCreateSchema>;
type MappingInput = z.infer<typeof paginationSchema> & {
  areaBlock?: string;
  businessSector?: string;
  actionNeeded?: boolean;
};

export async function listMappingProspects(actor: Actor, input: MappingInput) {
  const now = new Date();
  const where: Prisma.ProspectWhereInput = {
    AND: [
      prospectScope(actor),
      input.areaBlock ? { areaBlock: input.areaBlock } : {},
      input.businessSector ? { businessSector: input.businessSector } : {},
      input.actionNeeded
        ? {
            OR: [
              {
                opportunityStage: OpportunityStage.NEED_CONFIRMED,
                followUps: { none: { status: FollowUpStatus.PLANNED } },
              },
              {
                followUps: {
                  some: { status: FollowUpStatus.PLANNED, dueAt: { lte: now } },
                },
              },
            ],
          }
        : {},
      input.search
        ? {
            OR: [
              { internalCode: { contains: input.search, mode: "insensitive" } },
              {
                businessAlias: { contains: input.search, mode: "insensitive" },
              },
              { areaBlock: { contains: input.search, mode: "insensitive" } },
              {
                businessSector: { contains: input.search, mode: "insensitive" },
              },
            ],
          }
        : {},
    ],
  };
  const skip = (input.page - 1) * input.pageSize;
  const [items, total, facets] = await db.$transaction([
    db.prospect.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        visits: { orderBy: { visitedAt: "desc" }, take: 3 },
        followUps: {
          where: { status: FollowUpStatus.PLANNED },
          orderBy: { dueAt: "asc" },
          take: 1,
        },
        locationPhotos: {
          select: { id: true, width: true, height: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: input.pageSize,
    }),
    db.prospect.count({ where }),
    db.prospect.findMany({
      where: prospectScope(actor),
      select: { areaBlock: true, businessSector: true },
      distinct: ["areaBlock", "businessSector"],
    }),
  ]);
  return {
    items,
    facets,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      pages: Math.ceil(total / input.pageSize),
    },
  };
}

export async function createVisit(
  actor: Actor,
  input: VisitInput,
  requestId?: string | null,
) {
  assertAllowed(canRecordVisit(actor));
  const prospect = await db.prospect.findFirst({
    where: { id: input.prospectId, AND: [prospectScope(actor)] },
  });
  if (!prospect)
    throw new AppError(
      "Prospek tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  if (actor.role === Role.OUT_BRANCH && prospect.assignedToId !== actor.id)
    throw new AppError(
      "Visit hanya dapat dicatat PIC prospek.",
      403,
      "FORBIDDEN",
    );

  return db.$transaction(async (tx) => {
    const visit = await tx.visit.create({
      data: {
        prospectId: input.prospectId,
        visitedAt: input.visitedAt,
        outcome: input.outcome,
        notes: input.notes,
        nextAction: input.nextAction,
        nextActionDueAt: input.nextActionDueAt,
        createdById: actor.id,
      },
    });
    const confirmsNeed = (
      [
        VisitOutcome.NEED_CONFIRMED,
        VisitOutcome.FOLLOW_UP_REQUIRED,
        VisitOutcome.HANDOVER_READY,
      ] as VisitOutcome[]
    ).includes(input.outcome);
    if (confirmsNeed && prospect.opportunityStage === OpportunityStage.NEW) {
      await tx.prospect.update({
        where: { id: prospect.id },
        data: {
          opportunityStage: OpportunityStage.NEED_CONFIRMED,
          version: { increment: 1 },
        },
      });
    }
    let followUp = null;
    if (input.createFollowUp && input.nextAction && input.nextActionDueAt) {
      followUp = await tx.followUp.create({
        data: {
          prospectId: prospect.id,
          assignedToId: prospect.assignedToId,
          summary: input.notes,
          nextAction: input.nextAction,
          dueAt: input.nextActionDueAt,
        },
      });
      await tx.prospect.update({
        where: { id: prospect.id },
        data: {
          opportunityStage: OpportunityStage.FOLLOW_UP,
          version: { increment: 1 },
        },
      });
      await scheduleFollowUpJobs(tx, followUp, prospect.branchId);
      await createAssignmentNotification(tx, {
        recipientId: prospect.assignedToId,
        branchId: prospect.branchId,
        type: "PIC_ASSIGNMENT",
        title: "Tindak lanjut dari visit",
        message: `${prospect.internalCode} memerlukan tindakan lanjutan.`,
        link: `/follow-ups?task=${followUp.id}`,
        dedupKey: `followup-assignment:${followUp.id}:v1`,
        followUpId: followUp.id,
      });
    }
    await writeAudit(tx, actor, {
      entityType: "Visit",
      entityId: visit.id,
      action: followUp ? "VISIT_TO_FOLLOW_UP" : "VISIT_CREATED",
      branchId: prospect.branchId,
      after: {
        prospectId: prospect.id,
        outcome: visit.outcome,
        followUpId: followUp?.id,
      },
      requestId,
    });
    return { visit, followUp };
  });
}
