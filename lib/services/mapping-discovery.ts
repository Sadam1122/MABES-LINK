import { FollowUpStatus, MappingOfferResponse, OpportunityStage, Prisma, Role } from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { mappingProspectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  approvedMappingProducts,
  discoveryHints,
  foodScreeningResult,
  mappingDiscoverySchema,
  mappingOpportunitySchema,
  mappingProductCatalog,
} from "@/lib/mapping-discovery";
import { cancelFollowUpJobs, createAssignmentNotification, scheduleFollowUpJobs } from "@/lib/notifications";
import type { Actor } from "@/lib/session";

type DiscoveryInput = z.infer<typeof mappingDiscoverySchema>;
type OpportunityInput = z.infer<typeof mappingOpportunitySchema>;

async function accessibleProspect(actor: Actor, id: string) {
  const prospect = await db.prospect.findFirst({
    where: { id, AND: [mappingProspectScope(actor)] },
    select: { id: true, branchId: true, internalCode: true, assignedToId: true, businessSector: true, opportunityStage: true },
  });
  if (!prospect) throw new AppError("Lokasi tidak ditemukan atau di luar cakupan Anda.", 404, "NOT_FOUND");
  return prospect;
}

function canManageOpportunity(actor: Actor, assignedToId: string) {
  return actor.role === Role.ADMIN || actor.role === Role.SUPERVISOR || actor.id === assignedToId;
}

export async function getMappingDiscovery(actor: Actor, prospectId: string) {
  const prospect = await accessibleProspect(actor, prospectId);
  const [discovery, opportunities, officers] = await Promise.all([
    db.mappingDiscovery.findUnique({ where: { prospectId } }),
    db.mappingOpportunity.findMany({
      where: { prospectId, ...(actor.role === Role.ADMIN || actor.role === Role.SUPERVISOR ? {} : { assignedToId: actor.id }) },
      include: { assignedTo: { select: { id: true, name: true } }, followUp: { select: { id: true, status: true, dueAt: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({ where: { branchId: prospect.branchId, active: true, isTest: false }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    discovery,
    foodScreening: discovery ? foodScreeningResult({
      foodRule: discovery.foodRule,
      gofoodRating: discovery.gofoodRating == null ? null : Number(discovery.gofoodRating),
      gofoodReviews: discovery.gofoodReviews,
      gofoodCheckedAt: discovery.gofoodCheckedAt,
      grabfoodRating: discovery.grabfoodRating == null ? null : Number(discovery.grabfoodRating),
      grabfoodReviews: discovery.grabfoodReviews,
      grabfoodCheckedAt: discovery.grabfoodCheckedAt,
    }) : null,
    opportunities,
    officers: actor.role === Role.ADMIN || actor.role === Role.SUPERVISOR ? officers : officers.filter((item) => item.id === actor.id),
    productCatalog: mappingProductCatalog.map((item) => ({ ...item, approved: approvedMappingProducts().some((approved) => approved.code === item.code) })),
    hints: discoveryHints(prospect.businessSector),
    canEditDiscovery: canManageOpportunity(actor, prospect.assignedToId),
  };
}

export async function saveMappingDiscovery(actor: Actor, prospectId: string, input: DiscoveryInput, requestId?: string | null) {
  const prospect = await accessibleProspect(actor, prospectId);
  if (!canManageOpportunity(actor, prospect.assignedToId))
    throw new AppError("Catatan discovery hanya dapat diubah PIC lokasi atau supervisor.", 403, "FORBIDDEN");
  const now = new Date();
  for (const checkedAt of [input.sourceCheckedAt, input.gofoodCheckedAt, input.grabfoodCheckedAt]) {
    if (checkedAt && checkedAt.getTime() > now.getTime()) throw new AppError("Tanggal pengecekan tidak boleh di masa depan.", 422, "INVALID_DATE");
  }
  const { version, ...values } = input;
  return db.$transaction(async (tx) => {
    const current = await tx.mappingDiscovery.findUnique({ where: { prospectId } });
    if (current?.version !== version && !(current == null && version === 0))
      throw new AppError("Discovery telah berubah. Muat ulang sebelum menyimpan.", 409, "VERSION_CONFLICT");
    let saved;
    if (current) {
      const changed = await tx.mappingDiscovery.updateMany({ where: { prospectId, version }, data: { ...values, version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("Discovery telah berubah. Muat ulang sebelum menyimpan.", 409, "VERSION_CONFLICT");
      saved = await tx.mappingDiscovery.findUniqueOrThrow({ where: { prospectId } });
    } else {
      saved = await tx.mappingDiscovery.create({ data: { ...values, prospectId } });
    }
    await writeAudit(tx, actor, {
      entityType: "MappingDiscovery", entityId: saved.id, action: current ? "MAPPING_DISCOVERY_UPDATED" : "MAPPING_DISCOVERY_CREATED",
      branchId: prospect.branchId, requestId,
      before: current ? { version: current.version, segments: current.segments, opportunityTags: current.opportunityTags, riskReviewRequired: current.riskReviewRequired } : undefined,
      after: { version: saved.version, segments: saved.segments, opportunityTags: saved.opportunityTags, riskReviewRequired: saved.riskReviewRequired, foodRule: saved.foodRule },
    });
    return saved;
  });
}

export async function saveMappingOpportunity(actor: Actor, prospectId: string, input: OpportunityInput, requestId?: string | null) {
  const prospect = await accessibleProspect(actor, prospectId);
  if (!approvedMappingProducts().some((item) => item.code === input.productCode))
    throw new AppError("Produk ini belum masuk daftar penawaran yang disahkan untuk cabang.", 422, "PRODUCT_NOT_APPROVED");
  if (!canManageOpportunity(actor, input.assignedToId))
    throw new AppError("Petugas hanya dapat membuat peluang untuk dirinya sendiri.", 403, "FORBIDDEN");
  const assignee = await db.user.findFirst({ where: { id: input.assignedToId, branchId: prospect.branchId, active: true, isTest: false }, select: { id: true } });
  if (!assignee) throw new AppError("PIC harus aktif dan berada pada cabang lokasi.", 422, "INVALID_ASSIGNEE");
  if (input.dueAt && input.dueAt.getTime() <= Date.now())
    throw new AppError("Jadwal follow-up harus di masa depan.", 422, "INVALID_DUE_AT");
  const now = new Date();
  return db.$transaction(async (tx) => {
    const current = await tx.mappingOpportunity.findUnique({ where: { prospectId_productCode: { prospectId, productCode: input.productCode } }, include: { followUp: true } });
    if (current && !canManageOpportunity(actor, current.assignedToId)) throw new AppError("Peluang ini bukan tanggung jawab Anda.", 403, "FORBIDDEN");
    if (current?.version !== input.version && !(current == null && input.version === 0))
      throw new AppError("Peluang telah berubah. Muat ulang sebelum menyimpan.", 409, "VERSION_CONFLICT");
    const values = {
      needSummary: input.needSummary,
      discoveredAt: current?.discoveredAt ?? (input.discoveryDone ? now : null),
      needConfirmedAt: current?.needConfirmedAt ?? (input.needConfirmed ? now : null),
      benefitExplainedAt: input.benefitExplained ? current?.benefitExplainedAt ?? now : null,
      response: input.response, followUpConsent: input.followUpConsent,
      nextAction: input.nextAction, dueAt: input.dueAt, evidenceNote: input.evidenceNote,
      assignedToId: input.assignedToId,
    };
    let followUpId = current?.followUpId ?? null;
    if (current?.followUp) {
      await cancelFollowUpJobs(tx, current.followUp.id, "Peluang diperbarui.");
      if (current.followUp.status === FollowUpStatus.PLANNED) {
        const active = input.response === MappingOfferResponse.FOLLOW_UP && Boolean(input.dueAt && input.nextAction);
        const updated = await tx.followUp.update({ where: { id: current.followUp.id }, data: active ? {
          assignedToId: input.assignedToId, dueAt: input.dueAt!, nextAction: input.nextAction!, summary: input.needSummary, version: { increment: 1 },
        } : { status: FollowUpStatus.CANCELLED, version: { increment: 1 } } });
        if (active) {
          await scheduleFollowUpJobs(tx, updated, prospect.branchId);
          if (current.followUp.assignedToId !== input.assignedToId) await createAssignmentNotification(tx, {
            recipientId: input.assignedToId, branchId: prospect.branchId, type: "PIC_ASSIGNMENT",
            title: "Penugasan follow-up cross-selling", message: `${prospect.internalCode} ditugaskan kepada Anda.`,
            link: `/follow-ups?task=${updated.id}`,
            dedupKey: `mapping-opportunity:${current.id}:assignment:v${updated.version}`, followUpId: updated.id,
          });
        }
      } else if (input.response === MappingOfferResponse.FOLLOW_UP) {
        throw new AppError("Follow-up lama sudah selesai/dibatalkan. Buat tugas baru dari alur tindak lanjut.", 422, "FOLLOW_UP_CLOSED");
      }
    } else if (input.response === MappingOfferResponse.FOLLOW_UP && input.dueAt && input.nextAction) {
      const followUp = await tx.followUp.create({ data: { prospectId, assignedToId: input.assignedToId, summary: input.needSummary, nextAction: input.nextAction, dueAt: input.dueAt } });
      followUpId = followUp.id;
      await scheduleFollowUpJobs(tx, followUp, prospect.branchId);
      await createAssignmentNotification(tx, { recipientId: input.assignedToId, branchId: prospect.branchId, type: "PIC_ASSIGNMENT", title: "Follow-up cross-selling", message: `${prospect.internalCode} memerlukan tindak lanjut.`, link: `/follow-ups?task=${followUp.id}`, dedupKey: `mapping-opportunity:${prospectId}:${input.productCode}:assignment`, followUpId: followUp.id });
    }
    let saved;
    if (current) {
      const changed = await tx.mappingOpportunity.updateMany({ where: { id: current.id, version: input.version }, data: { ...values, followUpId, version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("Peluang telah berubah. Muat ulang sebelum menyimpan.", 409, "VERSION_CONFLICT");
      saved = await tx.mappingOpportunity.findUniqueOrThrow({ where: { id: current.id } });
    } else {
      saved = await tx.mappingOpportunity.create({ data: { ...values, prospectId, productCode: input.productCode, followUpId } });
    }
    if (input.needConfirmed && (prospect.opportunityStage === OpportunityStage.NEW || prospect.opportunityStage === OpportunityStage.NEED_CONFIRMED)) {
      await tx.prospect.update({ where: { id: prospectId }, data: { opportunityStage: input.response === MappingOfferResponse.FOLLOW_UP ? OpportunityStage.FOLLOW_UP : OpportunityStage.NEED_CONFIRMED, version: { increment: 1 } } });
    }
    await writeAudit(tx, actor, { entityType: "MappingOpportunity", entityId: saved.id, action: current ? "MAPPING_OPPORTUNITY_UPDATED" : "MAPPING_OPPORTUNITY_CREATED", branchId: prospect.branchId, requestId,
      before: current ? { version: current.version, assignedToId: current.assignedToId, response: current.response, dueAt: current.dueAt?.toISOString(), followUpId: current.followUpId } : undefined,
      after: { version: saved.version, assignedToId: saved.assignedToId, response: saved.response, dueAt: saved.dueAt?.toISOString(), followUpId: saved.followUpId, followUpConsent: saved.followUpConsent },
    });
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
