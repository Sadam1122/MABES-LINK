import { hashPassword } from "better-auth/crypto";
import { Role } from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { assertAllowed, canManageUsers } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import type {
  pilotConfigSchema,
  notificationConfigSchema,
  userCreateSchema,
  userPatchSchema,
} from "@/lib/validation";

type CreateInput = z.infer<typeof userCreateSchema>;
type PatchInput = z.infer<typeof userPatchSchema>;
type PilotConfigInput = z.infer<typeof pilotConfigSchema>;
type NotificationConfigInput = z.infer<typeof notificationConfigSchema>;

export async function listUsers(actor: Actor) {
  assertAllowed(canManageUsers(actor));
  return db.user.findMany({
    where: { isTest: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      emailNotificationsEnabled: true,
      branchId: true,
      branch: { select: { code: true, name: true } },
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createUser(actor: Actor, input: CreateInput) {
  assertAllowed(canManageUsers(actor));
  if (input.role !== Role.ADMIN && !input.branchId)
    throw new AppError(
      "Role operasional wajib memiliki cabang.",
      422,
      "BRANCH_REQUIRED",
    );
  if (input.branchId) {
    const branch = await db.branch.findUnique({
      where: { id: input.branchId },
    });
    if (!branch)
      throw new AppError("Cabang tidak ditemukan.", 422, "INVALID_BRANCH");
  }
  const password = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        emailVerified: true,
        role: input.role,
        branchId: input.branchId,
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password,
      },
    });
    await writeAudit(tx, actor, {
      entityType: "User",
      entityId: user.id,
      action: "USER_CREATED",
      branchId: input.branchId,
      after: {
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      branchId: user.branchId,
    };
  });
}

export async function updateUser(actor: Actor, id: string, input: PatchInput) {
  assertAllowed(canManageUsers(actor));
  if (id === actor.id && input.active === false)
    throw new AppError(
      "Admin tidak dapat menonaktifkan akunnya sendiri.",
      422,
      "SELF_DEACTIVATE",
    );
  const current = await db.user.findUnique({ where: { id } });
  if (!current)
    throw new AppError("Pengguna tidak ditemukan.", 404, "NOT_FOUND");
  const targetRole = input.role ?? current.role;
  const targetBranchId =
    input.branchId !== undefined ? input.branchId : current.branchId;
  if (targetRole !== Role.ADMIN && !targetBranchId)
    throw new AppError(
      "Role operasional wajib memiliki cabang.",
      422,
      "BRANCH_REQUIRED",
    );
  if (
    targetBranchId &&
    !(await db.branch.findUnique({
      where: { id: targetBranchId },
      select: { id: true },
    }))
  )
    throw new AppError("Cabang tidak ditemukan.", 422, "INVALID_BRANCH");
  return db.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: input });
    if (
      input.active === false ||
      input.role !== undefined ||
      input.branchId !== undefined
    )
      await tx.session.deleteMany({ where: { userId: id } });
    await writeAudit(tx, actor, {
      entityType: "User",
      entityId: id,
      action: "USER_UPDATED",
      branchId: user.branchId,
      before: {
        role: current.role,
        branchId: current.branchId,
        active: current.active,
      },
      after: { role: user.role, branchId: user.branchId, active: user.active },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      branchId: user.branchId,
    };
  });
}

export async function getPilotConfig(actor: Actor) {
  assertAllowed(canManageUsers(actor));
  return db.appConfig.findUnique({ where: { key: "pilot" } });
}

export async function updatePilotConfig(actor: Actor, input: PilotConfigInput) {
  assertAllowed(canManageUsers(actor));
  const current = await db.appConfig.findUnique({ where: { key: "pilot" } });
  const value = {
    ...((current?.value as Record<string, unknown> | null) ?? {}),
    ...input,
    stage: 2,
    branchCode: "11539",
  };
  const config = await db.$transaction(async (tx) => {
    const updated = await tx.appConfig.upsert({
      where: { key: "pilot" },
      create: {
        key: "pilot",
        value,
        description: "Konfigurasi pilot tahap 2",
        updatedById: actor.id,
      },
      update: { value, updatedById: actor.id },
    });
    await writeAudit(tx, actor, {
      entityType: "AppConfig",
      entityId: "pilot",
      action: "CONFIG_UPDATED",
      before: current?.value as never,
      after: value,
    });
    return updated;
  });
  return config;
}

export async function getNotificationConfig(actor: Actor) {
  assertAllowed(canManageUsers(actor));
  return db.appConfig.findUnique({ where: { key: "notifications" } });
}

export async function updateNotificationConfig(
  actor: Actor,
  input: NotificationConfigInput,
) {
  assertAllowed(canManageUsers(actor));
  const current = await db.appConfig.findUnique({
    where: { key: "notifications" },
  });
  return db.$transaction(async (tx) => {
    const updated = await tx.appConfig.upsert({
      where: { key: "notifications" },
      create: {
        key: "notifications",
        value: input,
        description: "Jadwal reminder internal; contoh pilot, bukan SOP bank",
        updatedById: actor.id,
      },
      update: { value: input, updatedById: actor.id },
    });
    await writeAudit(tx, actor, {
      entityType: "AppConfig",
      entityId: "notifications",
      action: "NOTIFICATION_CONFIG_UPDATED",
      before: current?.value as never,
      after: input,
    });
    return updated;
  });
}
