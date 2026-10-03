import { HandoverStatus, UsageStatus } from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import {
  assertAllowed,
  canRecordUsage,
  prospectScope,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import type { usageCreateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof usageCreateSchema>;

export async function createUsageVerification(
  actor: Actor,
  input: CreateInput,
  requestId?: string | null,
) {
  assertAllowed(canRecordUsage(actor));
  const prospect = await db.prospect.findFirst({
    where: { id: input.prospectId, AND: [prospectScope(actor)] },
    include: { handoverItems: { include: { batch: true } } },
  });
  if (!prospect)
    throw new AppError(
      "Prospek tidak ditemukan atau tidak dapat diakses.",
      404,
      "NOT_FOUND",
    );
  if (
    !prospect.handoverItems.some(
      (item) => item.batch.status === HandoverStatus.READY,
    )
  ) {
    throw new AppError(
      "Penggunaan hanya dapat diverifikasi setelah layanan berstatus siap.",
      422,
      "SERVICE_NOT_READY",
    );
  }
  return db.$transaction(async (tx) => {
    const usage = await tx.usageVerification.create({
      data: { ...input, recordedById: actor.id },
    });
    await writeAudit(tx, actor, {
      entityType: "UsageVerification",
      entityId: usage.id,
      action:
        input.status === UsageStatus.VERIFIED
          ? "USAGE_VERIFIED"
          : "USAGE_REJECTED",
      branchId: prospect.branchId,
      after: {
        prospectId: prospect.id,
        usedAt: input.usedAt.toISOString(),
        evidenceReference: input.evidenceReference,
        status: input.status,
      },
      requestId,
    });
    return usage;
  });
}
