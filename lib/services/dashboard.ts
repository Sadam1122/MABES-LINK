import {
  FollowUpStatus,
  HandoverStatus,
  OpportunityStage,
  UsageStatus,
} from "@prisma/client";

import {
  followUpScope,
  handoverScope,
  prospectScope,
  serviceCaseScope,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/session";

export async function getDashboard(actor: Actor) {
  const now = new Date();
  const pScope = prospectScope(actor);
  const hScope = handoverScope(actor);
  const fScope = followUpScope(actor);
  const sScope = serviceCaseScope(actor);

  const prospects = await db.prospect.count({ where: pScope });
  const followUpsCompleted = await db.followUp.count({
    where: { AND: [fScope, { status: FollowUpStatus.COMPLETED }] },
  });
  const followUpsOverdue = await db.followUp.count({
    where: {
      AND: [fScope, { status: FollowUpStatus.PLANNED, dueAt: { lt: now } }],
    },
  });
  const serviceCasesOverdue = await db.serviceCase.count({
    where: {
      AND: [
        sScope,
        {
          dueAt: { lt: now },
          OR: [
            { sourceSystem: null },
            { sourceSystem: { not: "MABES_LINK" } },
            {
              appointmentAt: { not: null },
              appointmentStatus: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          ],
          status: {
            notIn: ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"],
          },
        },
      ],
    },
  });
  const handoversAccepted = await db.handoverBatch.count({
    where: { AND: [hScope, { acceptedAt: { not: null } }] },
  });
  const servicesReady = await db.handoverBatch.count({
    where: { AND: [hScope, { status: HandoverStatus.READY }] },
  });
  const usageVerified = await db.usageVerification.count({
    where: { status: UsageStatus.VERIFIED, prospect: pScope },
  });
  const stages = await db.prospect.groupBy({
    by: ["opportunityStage"],
    where: pScope,
    orderBy: { opportunityStage: "asc" },
    _count: { _all: true },
  });
  const recent = await db.auditLog.findMany({
    where:
      actor.role === "ADMIN"
        ? {}
        : actor.role === "SUPERVISOR"
          ? { branchId: actor.branchId }
          : { branchId: actor.branchId, actorId: actor.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const mappedProspects = await db.prospect.count({
    where: {
      AND: [pScope, { latitude: { not: null }, longitude: { not: null } }],
    },
  });
  const visits = await db.visit.count({ where: { prospect: pScope } });
  const reminderSucceeded = await db.outboxJob.count({
    where: {
      isTest: false,
      status: "SUCCEEDED",
      ...(actor.role === "ADMIN" ? {} : { branchId: actor.branchId }),
    },
  });
  const reminderFailed = await db.outboxJob.count({
    where: {
      isTest: false,
      status: { in: ["FAILED", "UNKNOWN"] },
      ...(actor.role === "ADMIN" ? {} : { branchId: actor.branchId }),
    },
  });

  const stageMap = Object.fromEntries(
    stages.map((item) => [
      item.opportunityStage,
      typeof item._count === "object" ? (item._count._all ?? 0) : 0,
    ]),
  );
  return {
    metrics: {
      prospects,
      followUpsCompleted,
      followUpsOverdue: followUpsOverdue + serviceCasesOverdue,
      handoversAccepted,
      servicesReady,
      usageVerified,
      mappedProspects,
      visits,
      reminderSucceeded,
      reminderFailed,
    },
    pipeline: {
      new: stageMap[OpportunityStage.NEW] ?? 0,
      needConfirmed: stageMap[OpportunityStage.NEED_CONFIRMED] ?? 0,
      followUp: stageMap[OpportunityStage.FOLLOW_UP] ?? 0,
      handover: stageMap[OpportunityStage.HANDOVER] ?? 0,
      processing: stageMap[OpportunityStage.PROCESSING] ?? 0,
    },
    realization: { servicesReady, usageVerified },
    recent,
  };
}
