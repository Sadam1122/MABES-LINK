import { HandoverStatus, Prisma, Role } from "@prisma/client";

import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";

export function requireBranch(actor: Actor): string {
  if (!actor.branchId && actor.role !== Role.ADMIN) {
    throw new AppError(
      "Akun belum terhubung ke cabang.",
      403,
      "BRANCH_REQUIRED",
    );
  }
  return actor.branchId ?? "";
}

export function prospectScope(actor: Actor): Prisma.ProspectWhereInput {
  if (actor.role === Role.ADMIN) return { isTest: false };
  const branchId = requireBranch(actor);
  if (actor.role === Role.SUPERVISOR) return { branchId, isTest: false };
  if (actor.role === Role.OUT_BRANCH) {
    return {
      branchId,
      isTest: false,
      OR: [{ assignedToId: actor.id }, { createdById: actor.id }],
    };
  }
  return {
    branchId,
    isTest: false,
    OR: [
      { assignedToId: actor.id },
      { handoverItems: { some: { batch: { receiverId: actor.id } } } },
    ],
  };
}

export function followUpScope(actor: Actor): Prisma.FollowUpWhereInput {
  if (actor.role === Role.ADMIN) return { prospect: { isTest: false } };
  if (actor.role === Role.SUPERVISOR)
    return { prospect: { branchId: requireBranch(actor), isTest: false } };
  return {
    assignedToId: actor.id,
    prospect: { branchId: requireBranch(actor), isTest: false },
  };
}

export function handoverScope(actor: Actor): Prisma.HandoverBatchWhereInput {
  const operational = { items: { some: { prospect: { isTest: false } } } };
  if (actor.role === Role.ADMIN) return operational;
  const branchId = requireBranch(actor);
  if (actor.role === Role.SUPERVISOR) return { branchId, ...operational };
  return actor.role === Role.OUT_BRANCH
    ? { branchId, senderId: actor.id, ...operational }
    : { branchId, receiverId: actor.id, ...operational };
}

export function serviceCaseScope(actor: Actor): Prisma.ServiceCaseWhereInput {
  if (actor.role === Role.ADMIN) return { isTest: false };
  const branchId = requireBranch(actor);
  if (actor.role === Role.SUPERVISOR) return { branchId, isTest: false };
  return { branchId, isTest: false, picId: actor.id };
}

export function canCreateProspect(actor: Actor) {
  return ([Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
    actor.role,
  );
}

export function canRecordVisit(actor: Actor) {
  return ([Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
    actor.role,
  );
}

export function canRecordUsage(actor: Actor) {
  return ([Role.CS, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
    actor.role,
  );
}

export function canManageUsers(actor: Actor) {
  return actor.role === Role.ADMIN;
}

export function canTransitionHandover(
  actor: Actor,
  batch: { senderId: string; receiverId: string | null; branchId: string },
  to: HandoverStatus,
) {
  if (actor.role === Role.ADMIN) return true;
  if (actor.role === Role.SUPERVISOR) return actor.branchId === batch.branchId;
  if (to === HandoverStatus.SUBMITTED)
    return actor.role === Role.OUT_BRANCH && actor.id === batch.senderId;
  return actor.role === Role.CS && actor.id === batch.receiverId;
}

export function assertAllowed(
  condition: boolean,
  message = "Anda tidak berwenang untuk tindakan ini.",
) {
  if (!condition) throw new AppError(message, 403, "FORBIDDEN");
}
