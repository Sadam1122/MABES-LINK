import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";

export async function listNotifications(
  actor: Actor,
  cursor?: bigint,
  limit = 30,
) {
  const items = await db.notification.findMany({
    where: {
      recipientId: actor.id,
      isTest: false,
      ...(actor.branchId
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: cursor ? "asc" : "desc" },
    take: Math.min(limit, 100),
  });
  return items.map((item) => ({ ...item, id: item.id.toString() }));
}

export async function markNotificationRead(actor: Actor, id: bigint) {
  const result = await db.notification.updateMany({
    where: { id, recipientId: actor.id },
    data: { readAt: new Date() },
  });
  if (result.count !== 1)
    throw new AppError("Notifikasi tidak ditemukan.", 404, "NOT_FOUND");
}

export async function markAllNotificationsRead(actor: Actor) {
  const result = await db.notification.updateMany({
    where: {
      recipientId: actor.id,
      isTest: false,
      readAt: null,
      ...(actor.branchId
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : {}),
    },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
