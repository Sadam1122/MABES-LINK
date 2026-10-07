import { OpportunityStage, Prisma, Role } from "@prisma/client";
import type { z } from "zod";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createAssignmentNotification,
  scheduleFollowUpJobs,
} from "@/lib/notifications";
import { hashValue, loadQrisSession } from "@/lib/qris-custom";
import { publicQrisContactSchema } from "@/lib/qris-design";
import { makeCode } from "@/lib/utils";

type Input = z.infer<typeof publicQrisContactSchema>;

function jakartaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function submitPublicQrisContact(input: Input) {
  const { session } = await loadQrisSession(input.sessionId, input.token);
  if (!input.contactConsent) return { followUp: false as const };

  const branch = await db.branch.findUnique({ where: { code: "11539" } });
  if (!branch)
    throw new AppError(
      "Cabang penerima belum dikonfigurasi.",
      503,
      "BRANCH_UNAVAILABLE",
    );
  const assignee = await db.user.findFirst({
    where: {
      branchId: branch.id,
      active: true,
      isTest: false,
      role: { in: [Role.OUT_BRANCH, Role.CS] },
    },
    orderBy: [{ role: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!assignee)
    throw new AppError(
      "Petugas penerima belum tersedia.",
      503,
      "ASSIGNEE_UNAVAILABLE",
    );

  const normalizedPhone = input.phone.replace(/\D/g, "");
  const dedupKey = hashValue(
    `${normalizedPhone}:${input.businessName.toLocaleLowerCase("id-ID")}:${jakartaDayKey()}`,
  );
  const existing = await db.prospect.findFirst({
    where: {
      OR: [
        { publicQrisRequestId: input.requestId },
        { publicDedupKey: dedupKey },
      ],
    },
    select: { id: true, publicQrisRequestId: true },
  });
  if (existing) {
    if (existing.publicQrisRequestId && existing.publicQrisRequestId !== session.publicRequestId)
      await db.qrisDesignSession.update({ where: { id: session.id }, data: { publicRequestId: existing.publicQrisRequestId } });
    return { followUp: true as const };
  }

  try {
    await db.$transaction(async (tx) => {
      const now = new Date();
      const prospect = await tx.prospect.create({
        data: {
          internalCode: makeCode("QR-11539"),
          publicQrisRequestId: input.requestId,
          publicDedupKey: dedupKey,
          publicContactPhone: input.phone,
          publicBusinessCategory: input.businessCategory || null,
          publicBankRelationship: input.bankRelationship,
          publicContactWindow: input.contactWindow,
          publicContactConsentAt: now,
          publicQrisTemplate: session.selectedTemplate,
          businessAlias: input.businessName,
          need:
            input.needNote ||
            "Permintaan informasi QRIS Custom dan solusi merchant.",
          contactPic: input.contactName,
          businessSector: input.businessCategory || null,
          addressHint: input.address || null,
          latitude: input.latitude,
          longitude: input.longitude,
          locationLabel: input.businessName,
          locationSource: input.locationSource,
          locationUpdatedAt: now,
          productNeeds: [input.interestedProduct],
          opportunityStage: OpportunityStage.FOLLOW_UP,
          branchId: branch.id,
          assignedToId: assignee.id,
          createdById: null,
        },
      });
      const followUp = await tx.followUp.create({
        data: {
          prospectId: prospect.id,
          assignedToId: assignee.id,
          summary: "Permintaan tindak lanjut QRIS Custom dari kanal publik",
          nextAction:
            "Hubungi kontak yang memberi persetujuan; konfirmasi kebutuhan dan jadwal.",
          dueAt: new Date(now.getTime() + 24 * 60 * 60_000),
        },
      });
      await scheduleFollowUpJobs(tx, followUp, branch.id);
      await createAssignmentNotification(tx, {
        recipientId: assignee.id,
        branchId: branch.id,
        title: "Permintaan QRIS Custom baru",
        message: `Tugas ${prospect.internalCode} menunggu tindak lanjut.`,
        link: `/prospects/${prospect.id}`,
        dedupKey: `public-qris:${prospect.id}:assigned`,
        type: "PIC_ASSIGNMENT",
        followUpId: followUp.id,
      });
      await tx.auditLog.create({
        data: {
          branchId: branch.id,
          actorName: "Pengunjung publik (persetujuan kontak)",
          entityType: "Prospect",
          entityId: prospect.id,
          action: "PUBLIC_QRIS_REQUEST_CREATED",
          after: {
            requestId: input.requestId,
            consentAt: now.toISOString(),
            assignedToId: assignee.id,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await db.prospect.findFirst({
        where: { OR: [{ publicQrisRequestId: input.requestId }, { publicDedupKey: dedupKey }] },
        select: { publicQrisRequestId: true },
      });
      if (winner?.publicQrisRequestId)
        await db.qrisDesignSession.update({ where: { id: session.id }, data: { publicRequestId: winner.publicQrisRequestId } });
      return { followUp: true as const };
    }
    throw error;
  }
  return { followUp: true as const };
}
