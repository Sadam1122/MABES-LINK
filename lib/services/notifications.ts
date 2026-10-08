import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import {
  REMINDER_GRACE_MS,
  appointmentAlarmDeadline,
} from "@/lib/appointment-reminders";
import { Prisma } from "@prisma/client";

export async function claimNotificationPresentation(
  actor: Actor,
  id: bigint,
  channel: "AUDIO" | "POPUP",
) {
  const notice = await db.notification.findFirst({
    where: { id, ...notificationScope(actor) },
  });
  if (!notice)
    throw new AppError("Notifikasi tidak ditemukan.", 404, "NOT_FOUND");
  const now = new Date();
  if (
    notice.readAt ||
    now.getTime() - notice.createdAt.getTime() > REMINDER_GRACE_MS ||
    (notice.reminderExpiresAt && notice.reminderExpiresAt <= now)
  )
    return { claimed: false, reason: "expired-or-read" };
  const field = channel === "AUDIO" ? "audioClaimedAt" : "popupClaimedAt";
  const result = await db.$transaction(async (tx) => {
    if (notice.serviceCaseId && notice.type.startsWith("APPOINTMENT_")) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${notice.serviceCaseId} FOR UPDATE`,
      );
      const current = await tx.serviceCase.findUnique({
        where: { id: notice.serviceCaseId },
        include: { participants: { select: { userId: true } } },
      });
      const job = notice.dedupKey.startsWith("job:")
        ? await tx.outboxJob.findUnique({
            where: { id: notice.dedupKey.slice(4) },
          })
        : null;
      if (
        !current ||
        current.deletedAt ||
        current.appointmentStatus !== "CONFIRMED" ||
        !current.appointmentAt ||
        appointmentAlarmDeadline(current.appointmentAt, notice.type) <= now ||
        (notice.type === "APPOINTMENT_ACTION_DUE" &&
          current.appointmentAt > now) ||
        (current.sourceSystem === "MABES_LINK" && !current.acceptedAt) ||
        ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(
          current.status,
        ) ||
        (current.picId !== actor.id &&
          !current.participants.some((p) => p.userId === actor.id)) ||
        !job ||
        job.scheduleVersion !== current.version ||
        job.status === "CANCELLED"
      )
        return { count: 0 };
    }
    return tx.notification.updateMany({
      where: {
        id,
        readAt: null,
        [field]: null,
        createdAt: { gt: new Date(now.getTime() - REMINDER_GRACE_MS) },
        AND: [
          notificationScope(actor),
          {
            OR: [
              { reminderExpiresAt: null },
              { reminderExpiresAt: { gt: now } },
            ],
          },
        ],
      },
      data: { [field]: now },
    });
  });
  return {
    claimed: result.count === 1,
    reason: result.count === 1 ? "claimed" : "already-claimed",
  };
}

export async function listNotifications(
  actor: Actor,
  cursor?: bigint,
  limit = 30,
) {
  const items = await db.notification.findMany({
    where: {
      ...notificationScope(actor),
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: cursor !== undefined ? "asc" : "desc" },
    take: Math.min(limit, 100),
  });
  return items.map((item) => ({ ...item, id: item.id.toString() }));
}

export async function markNotificationRead(actor: Actor, id: bigint) {
  const result = await db.notification.updateMany({
    where: { id, ...notificationScope(actor) },
    data: { readAt: new Date() },
  });
  if (result.count !== 1)
    throw new AppError("Notifikasi tidak ditemukan.", 404, "NOT_FOUND");
}

export async function markAllNotificationsRead(actor: Actor) {
  const result = await db.notification.updateMany({
    where: {
      ...notificationScope(actor),
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

function notificationScope(actor: Actor) {
  return {
    recipientId: actor.id,
    isTest: false,
    ...(actor.branchId
      ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
      : {}),
  };
}
