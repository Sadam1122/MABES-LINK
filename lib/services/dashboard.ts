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

  const [
    prospects,
    followUpsCompleted,
    followUpsOverdue,
    serviceCasesOverdue,
    handoversAccepted,
    servicesReady,
    usageVerified,
    stages,
    recent,
    mappedProspects,
    visits,
    reminderSucceeded,
    reminderFailed,
  ] = await db.$transaction([
    db.prospect.count({ where: pScope }),
    db.followUp.count({
      where: { AND: [fScope, { status: FollowUpStatus.COMPLETED }] },
    }),
    db.followUp.count({
      where: {
        AND: [fScope, { status: FollowUpStatus.PLANNED, dueAt: { lt: now } }],
      },
    }),
    db.serviceCase.count({
      where: {
        AND: [
          sScope,
          {
            dueAt: { lt: now },
            status: {
              notIn: ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"],
            },
          },
        ],
      },
    }),
    db.handoverBatch.count({
      where: { AND: [hScope, { acceptedAt: { not: null } }] },
    }),
    db.handoverBatch.count({
      where: { AND: [hScope, { status: HandoverStatus.READY }] },
    }),
    db.usageVerification.count({
      where: { status: UsageStatus.VERIFIED, prospect: pScope },
    }),
    db.prospect.groupBy({
      by: ["opportunityStage"],
      where: pScope,
      orderBy: { opportunityStage: "asc" },
      _count: { _all: true },
    }),
    db.auditLog.findMany({
      where:
        actor.role === "ADMIN"
          ? {}
          : actor.role === "SUPERVISOR"
            ? { branchId: actor.branchId }
            : { branchId: actor.branchId, actorId: actor.id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.prospect.count({
      where: {
        AND: [pScope, { latitude: { not: null }, longitude: { not: null } }],
      },
    }),
    db.visit.count({ where: { prospect: pScope } }),
    db.outboxJob.count({
      where: {
        isTest: false,
        status: "SUCCEEDED",
        ...(actor.role === "ADMIN" ? {} : { branchId: actor.branchId }),
      },
    }),
    db.outboxJob.count({
      where: {
        isTest: false,
        status: { in: ["FAILED", "UNKNOWN"] },
        ...(actor.role === "ADMIN" ? {} : { branchId: actor.branchId }),
      },
    }),
  ]);

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
