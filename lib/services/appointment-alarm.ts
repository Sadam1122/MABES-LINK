import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import {
  REMINDER_GRACE_MS,
  appointmentAlarmDeadline,
} from "@/lib/appointment-reminders";
import type { Actor } from "@/lib/session";

export const alarmActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("DISMISS") }).strict(),
  z
    .object({
      action: z.literal("SNOOZE"),
      minutes: z.union([z.literal(1), z.literal(5), z.literal(10)]),
    })
    .strict(),
]);
type Tx = Prisma.TransactionClient;
async function alarmContext(actor: Actor, id: bigint, client: Tx = db) {
  const notice = await client.notification.findFirst({
    where: {
      id,
      recipientId: actor.id,
      isTest: false,
      ...(actor.branchId
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : {}),
    },
  });
  if (
    !notice ||
    !notice.serviceCaseId ||
    !notice.type.startsWith("APPOINTMENT_")
  )
    throw new AppError("Pengingat janji tidak ditemukan.", 404, "NOT_FOUND");
  const record = await client.serviceCase.findUnique({
    where: { id: notice.serviceCaseId },
  });
  // Sequential relation reads avoid concurrent queries on one pg transaction connection.
  const participants = record
    ? await client.serviceCaseParticipant.findMany({
        where: { serviceCaseId: record.id },
        select: { userId: true },
      })
    : [];
  const pic = record
    ? await client.user.findUnique({
        where: { id: record.picId },
        select: { name: true },
      })
    : null;
  const prospect = record
    ? await client.prospect.findUnique({
        where: { id: record.prospectId },
        select: { contactPic: true, businessAlias: true, locationLabel: true },
      })
    : null;
  const item =
    record && pic && prospect
      ? { ...record, participants, pic, prospect }
      : null;
  const job = notice.dedupKey.startsWith("job:")
    ? await client.outboxJob.findUnique({
        where: { id: notice.dedupKey.slice(4) },
      })
    : null;
  const valid = Boolean(
    item &&
      !item.deletedAt &&
      !item.isTest &&
      (item.picId === actor.id ||
        item.participants.some((p) => p.userId === actor.id)) &&
      item.appointmentStatus === "CONFIRMED" &&
      item.appointmentAt &&
      appointmentAlarmDeadline(item.appointmentAt, notice.type) > new Date() &&
      (notice.type !== "APPOINTMENT_ACTION_DUE" ||
        item.appointmentAt <= new Date()) &&
      (item.sourceSystem !== "MABES_LINK" || item.acceptedAt) &&
      !["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(item.status) &&
      job &&
      job.recipientId === actor.id &&
      job.serviceCaseId === item.id &&
      job.scheduleVersion === item.version &&
      job.status !== "CANCELLED",
  );
  return { notice, item, job, valid };
}

export async function getAppointmentAlarm(actor: Actor, id: bigint) {
  const { notice, item, valid } = await alarmContext(actor, id);
  // Only the authorized reminder recipient sees these internal appointment details.
  return {
    serverNow: new Date().toISOString(),
    active: valid && !notice.readAt && !notice.alarmDismissedAt,
    dismissedAt: notice.alarmDismissedAt,
    snoozedUntil: notice.snoozedUntil,
    snoozeDeadline:
      valid && item?.appointmentAt
        ? appointmentAlarmDeadline(
            item.appointmentAt,
            notice.type,
          ).toISOString()
        : null,
    appointment:
      valid && item
        ? {
            code: item.code,
            title: item.title,
            appointmentAt: item.appointmentAt,
            contact: item.prospect.contactPic,
            business: item.prospect.businessAlias,
            location: item.prospect.locationLabel,
            nextAction: item.nextAction,
            controller: item.pic.name,
            link: `/work/${item.id}`,
          }
        : null,
  };
}

export async function actOnAppointmentAlarm(
  actor: Actor,
  id: bigint,
  input: z.infer<typeof alarmActionSchema>,
) {
  const initial = await alarmContext(actor, id);
  return db.$transaction(async (tx) => {
    // Lock order agrees with publication/presentation: case before notification.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${initial.notice.serviceCaseId} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Notification" WHERE id = ${id} FOR UPDATE`,
    );
    const { notice, item, valid } = await alarmContext(actor, id, tx);
    if (notice.alarmDismissedAt)
      return {
        dismissedAt: notice.alarmDismissedAt,
        snoozedUntil: notice.snoozedUntil,
      };
    const now = new Date();
    let until: Date | null = null;
    if (input.action === "SNOOZE") {
      if (!valid || !item || notice.readAt)
        throw new AppError(
          "Jadwal berubah, selesai, atau tidak lagi aktif. Pengingat tidak diulang.",
          409,
          "ALARM_INACTIVE",
        );
      until = new Date(now.getTime() + input.minutes * 60_000);
      const deadline = appointmentAlarmDeadline(
        item.appointmentAt!,
        notice.type,
      );
      if (until >= deadline)
        throw new AppError(
          "Pilihan ingatkan lagi melewati batas alarm. Pilih jeda lebih singkat atau Matikan (alarm saat janji dapat diulang sampai 1 jam setelah jadwal).",
          422,
          "SNOOZE_TOO_LATE",
        );
      await tx.outboxJob.create({
        data: {
          type:
            notice.type === "APPOINTMENT_ACTION_DUE"
              ? "APPOINTMENT_ACTION_DUE"
              : "APPOINTMENT_PRE_DUE",
          recipientId: actor.id,
          branchId: item.branchId,
          serviceCaseId: item.id,
          scheduleVersion: item.version,
          runAt: until,
          dedupKey: `alarm-snooze:${notice.id}`,
          payload: {
            policy: "APPOINTMENT_V2",
            snoozeMinutes: input.minutes,
            parentNotificationId: notice.id.toString(),
            appointmentAt: item.appointmentAt!.toISOString(),
            expiresAt: new Date(
              Math.min(until.getTime() + REMINDER_GRACE_MS, deadline.getTime()),
            ).toISOString(),
            distanceStatus: "SNOOZE",
            minutesBefore: notice.type === "APPOINTMENT_ACTION_DUE" ? 0 : -1,
          },
        },
      });
    }
    await tx.notification.update({
      where: { id },
      data: { readAt: now, alarmDismissedAt: now, snoozedUntil: until },
    });
    await writeAudit(tx, actor, {
      entityType: "Notification",
      entityId: id.toString(),
      action:
        input.action === "SNOOZE"
          ? "APPOINTMENT_ALARM_SNOOZED"
          : "APPOINTMENT_ALARM_DISMISSED",
      branchId: notice.branchId,
      after: {
        serviceCaseId: notice.serviceCaseId,
        snoozedUntil: until?.toISOString() ?? null,
      },
    });
    return { dismissedAt: now, snoozedUntil: until };
  });
}
