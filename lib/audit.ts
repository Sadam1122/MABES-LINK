import type { Prisma, PrismaClient } from "@prisma/client";

import type { Actor } from "@/lib/session";

type DbLike = Prisma.TransactionClient | PrismaClient;

export async function writeAudit(
  tx: DbLike,
  actor: Actor,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    branchId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    requestId?: string | null;
  },
) {
  return tx.auditLog.create({
    data: {
      actorId: actor.id,
      branchId: input.branchId ?? actor.branchId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before,
      after: input.after,
      requestId: input.requestId,
    },
  });
}
