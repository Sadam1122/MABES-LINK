import {
  EmailDeliveryStatus,
  AppointmentStatus,
  FollowUpStatus,
  NotificationType,
  OutboxJobType,
  OutboxStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import { hostname } from "node:os";

import { db } from "@/lib/db";
import {
  appointmentDistancePolicy,
  appointmentAlarmDeadline,
  REMINDER_GRACE_MS,
  appointmentReminderPlan,
  verifiedAppointmentBranch,
} from "@/lib/appointment-reminders";

type Tx = Prisma.TransactionClient;

export const notificationDefaults = {
  reminderMinutesBefore: 30,
  digestTime: "08:00",
  quietStart: "20:00",
  quietEnd: "07:00",
  timezone: "Asia/Jakarta" as const,
};

export function followUpJobKey(
  id: string,
  version: number,
  kind: "pre" | "due",
) {
  return `followup:${id}:v${version}:${kind}`;
}

export function applyJakartaQuietHours(
  runAt: Date,
  quietStart = "20:00",
  quietEnd = "07:00",
) {
  const local = new Date(runAt.getTime() + 7 * 60 * 60_000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMinute = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinute(quietStart);
  const end = toMinute(quietEnd);
  const quiet =
    start > end
      ? minute >= start || minute < end
      : minute >= start && minute < end;
  if (!quiet) return runAt;
  if (start > end && minute >= start) local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(Math.floor(end / 60), end % 60, 0, 0);
  return new Date(local.getTime() - 7 * 60 * 60_000);
}

export async function scheduleFollowUpJobs(
  tx: Tx,
  followUp: { id: string; assignedToId: string; dueAt: Date; version: number },
  branchId: string,
) {
  await tx.outboxJob.updateMany({
    where: {
      followUpId: followUp.id,
      status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
    },
    data: {
      status: OutboxStatus.CANCELLED,
      completedAt: new Date(),
      lastError: "Jadwal/PIC/status berubah.",
    },
  });
  const config = await tx.appConfig.findUnique({
    where: { key: "notifications" },
  });
  const minutes = Number(
    (config?.value as Record<string, unknown> | null)?.reminderMinutesBefore ??
      30,
  );
  const raw = config?.value as Record<string, unknown> | null;
  const quietStart = String(raw?.quietStart ?? "20:00");
  const quietEnd = String(raw?.quietEnd ?? "07:00");
  const preRunAt = applyJakartaQuietHours(
    new Date(followUp.dueAt.getTime() - minutes * 60_000),
    quietStart,
    quietEnd,
  );
  const dueRunAt = applyJakartaQuietHours(followUp.dueAt, quietStart, quietEnd);
  await tx.outboxJob.createMany({
    data: [
      {
        type: OutboxJobType.FOLLOW_UP_PRE_DUE,
        dedupKey: followUpJobKey(followUp.id, followUp.version, "pre"),
        recipientId: followUp.assignedToId,
        branchId,
        followUpId: followUp.id,
        scheduleVersion: followUp.version,
        runAt: preRunAt,
      },
      {
        type: OutboxJobType.FOLLOW_UP_DUE,
        dedupKey: followUpJobKey(followUp.id, followUp.version, "due"),
        recipientId: followUp.assignedToId,
        branchId,
        followUpId: followUp.id,
        scheduleVersion: followUp.version,
        runAt: dueRunAt,
      },
    ],
    skipDuplicates: true,
  });
}

export async function cancelFollowUpJobs(
  tx: Tx,
  followUpId: string,
  reason: string,
) {
  await tx.outboxJob.updateMany({
    where: {
      followUpId,
      status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
    },
    data: {
      status: OutboxStatus.CANCELLED,
      completedAt: new Date(),
      lastError: reason,
    },
  });
}

export async function scheduleServiceCaseJobs(
  tx: Tx,
  serviceCase: {
    id: string;
    picId: string;
    dueAt: Date;
    appointmentAt: Date | null;
    version: number;
    appointmentStatus: AppointmentStatus;
    isTest: boolean;
    testNamespace: string | null;
    sourceSystem?: string | null;
    acceptedAt?: Date | null;
  },
  branchId: string,
) {
  await tx.outboxJob.updateMany({
    where: {
      serviceCaseId: serviceCase.id,
      status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
    },
    data: {
      status: OutboxStatus.CANCELLED,
      completedAt: new Date(),
      lastError: "Jadwal, PIC, atau status janji berubah.",
    },
  });
  await tx.notification.updateMany({
    where: {
      serviceCaseId: serviceCase.id,
      type: { in: ["APPOINTMENT_PRE_DUE", "APPOINTMENT_ACTION_DUE"] },
    },
    data: { reminderExpiresAt: new Date() },
  });
  if (
    serviceCase.appointmentStatus === AppointmentStatus.CONFIRMED ||
    serviceCase.sourceSystem === "MABES_LINK"
  ) {
    if (serviceCase.sourceSystem === "MABES_LINK" && !serviceCase.acceptedAt)
      return;
    const prospect = await tx.serviceCase.findUniqueOrThrow({
      where: { id: serviceCase.id },
      select: {
        prospect: {
          select: {
            latitude: true,
            longitude: true,
            locationVerifiedAt: true,
            locationUpdatedAt: true,
          },
        },
      },
    });
    const point = {
      ...prospect.prospect,
      latitude:
        prospect.prospect.latitude == null
          ? null
          : Number(prospect.prospect.latitude),
      longitude:
        prospect.prospect.longitude == null
          ? null
          : Number(prospect.prospect.longitude),
    };
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });
    const plan = appointmentReminderPlan(
      serviceCase.appointmentAt,
      serviceCase.appointmentStatus === "CONFIRMED",
      point,
      branch?.code === "11539" ? verifiedAppointmentBranch() : null,
    );
    const participants = await tx.serviceCaseParticipant.findMany({
      where: { serviceCaseId: serviceCase.id },
      select: { userId: true },
    });
    await tx.outboxJob.createMany({
      data: [
        ...new Set([serviceCase.picId, ...participants.map((p) => p.userId)]),
      ].flatMap((recipientId) =>
        plan.reminders.map((reminder) => ({
          recipientId,
          branchId,
          serviceCaseId: serviceCase.id,
          scheduleVersion: serviceCase.version,
          isTest: serviceCase.isTest,
          testNamespace: serviceCase.testNamespace,
          type:
            reminder.minutesBefore === 0
              ? OutboxJobType.APPOINTMENT_ACTION_DUE
              : OutboxJobType.APPOINTMENT_PRE_DUE,
          dedupKey: `appointment:${serviceCase.id}:v${serviceCase.version}:recipient:${recipientId}:v2:${reminder.minutesBefore}`,
          runAt: reminder.runAt,
          payload: {
            policy: "APPOINTMENT_V2",
            minutesBefore: reminder.minutesBefore,
            expiresAt: reminder.expiresAt.toISOString(),
            appointmentAt: serviceCase.appointmentAt!.toISOString(),
            distanceStatus: plan.status,
          },
        })),
      ),
      skipDuplicates: true,
    });
    return;
  }
  if (
    serviceCase.appointmentStatus !== AppointmentStatus.NEEDS_SCHEDULING &&
    serviceCase.appointmentStatus !== AppointmentStatus.PENDING_CONFIRMATION
  )
    return;
  const config = await tx.appConfig.findUnique({
    where: { key: "notifications" },
  });
  const raw = config?.value as Record<string, unknown> | null;
  const minutes = Number(raw?.reminderMinutesBefore ?? 30);
  const quietStart = String(raw?.quietStart ?? "20:00");
  const quietEnd = String(raw?.quietEnd ?? "07:00");
  const prefix = `appointment:${serviceCase.id}:v${serviceCase.version}`;
  const reminderAt = serviceCase.dueAt;
  const preReminderAt = new Date(reminderAt.getTime() - minutes * 60_000);
  const participants = await tx.serviceCaseParticipant.findMany({
    where: { serviceCaseId: serviceCase.id },
    select: { userId: true },
  });
  const recipients = Array.from(
    new Set([serviceCase.picId, ...participants.map((item) => item.userId)]),
  );
  const data: Prisma.OutboxJobCreateManyInput[] = [];
  for (const recipientId of recipients) {
    const recipientPrefix = `${prefix}:recipient:${recipientId}`;
    const baseJob = {
      recipientId,
      branchId,
      serviceCaseId: serviceCase.id,
      scheduleVersion: serviceCase.version,
      isTest: serviceCase.isTest,
      testNamespace: serviceCase.testNamespace,
    };
    data.push({
      ...baseJob,
      type: OutboxJobType.APPOINTMENT_PRE_DUE,
      dedupKey: `${recipientPrefix}:pre`,
      runAt: applyJakartaQuietHours(preReminderAt, quietStart, quietEnd),
    });
    data.push({
      ...baseJob,
      type: OutboxJobType.APPOINTMENT_ACTION_DUE,
      dedupKey: `${recipientPrefix}:due`,
      runAt: applyJakartaQuietHours(reminderAt, quietStart, quietEnd),
    });
  }
  await tx.outboxJob.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function cancelServiceCaseJobs(
  tx: Tx,
  serviceCaseId: string,
  reason: string,
) {
  await tx.notification.updateMany({
    where: {
      serviceCaseId,
      type: { in: ["APPOINTMENT_PRE_DUE", "APPOINTMENT_ACTION_DUE"] },
    },
    data: { reminderExpiresAt: new Date() },
  });
  await tx.outboxJob.updateMany({
    where: {
      serviceCaseId,
      status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
    },
    data: {
      status: OutboxStatus.CANCELLED,
      completedAt: new Date(),
      lastError: reason,
    },
  });
}

export async function createAssignmentNotification(
  tx: Tx,
  input: {
    recipientId: string;
    branchId: string;
    title: string;
    message: string;
    link: string;
    dedupKey: string;
    type: NotificationType;
    followUpId?: string;
    handoverId?: string;
    serviceCaseId?: string;
  },
) {
  return tx.notification.upsert({
    where: { dedupKey: input.dedupKey },
    create: input,
    update: {},
  });
}

export function jakartaDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function jakartaTimeToUtc(
  date: { year: number; month: number; day: number },
  hhmm: string,
) {
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, hour - 7, minute),
  );
}

export async function ensureDailyDigests(
  client: PrismaClient = db,
  now = new Date(),
) {
  const config = await client.appConfig.findUnique({
    where: { key: "notifications" },
  });
  const digestTime = String(
    (config?.value as Record<string, unknown> | null)?.digestTime ?? "08:00",
  );
  const date = jakartaDateParts(now);
  const dayKey = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  const users = await client.user.findMany({
    where: { active: true, isTest: false, branchId: { not: null } },
    select: { id: true, branchId: true },
  });
  await client.outboxJob.createMany({
    data: users.map((user) => ({
      type: OutboxJobType.OVERDUE_DIGEST,
      dedupKey: `overdue:${user.id}:${dayKey}`,
      recipientId: user.id,
      branchId: user.branchId,
      runAt: jakartaTimeToUtc(date, digestTime),
      payload: { dayKey },
    })),
    skipDuplicates: true,
  });
}

export type ClaimedJob = {
  id: string;
  type: OutboxJobType;
  recipientId: string;
  branchId: string | null;
  followUpId: string | null;
  serviceCaseId: string | null;
  scheduleVersion: number | null;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  payload?: Prisma.JsonValue | null;
};

export async function claimJobs(
  client: PrismaClient,
  workerId: string,
  now = new Date(),
  limit = 10,
): Promise<ClaimedJob[]> {
  const lease = new Date(now.getTime() + 2 * 60_000);
  return client.$queryRaw<ClaimedJob[]>(Prisma.sql`
    WITH candidates AS (
      SELECT id FROM "OutboxJob"
      WHERE status = 'PENDING' AND "runAt" <= ${now}
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "OutboxJob" j SET
      status = 'PROCESSING', "lockedBy" = ${workerId}, "lockedAt" = ${now},
      "leaseExpiresAt" = ${lease}, attempts = attempts + 1, "updatedAt" = NOW()
    FROM candidates c WHERE j.id = c.id
    RETURNING j.id, j.type, j."recipientId", j."branchId", j."followUpId", j."serviceCaseId",
      j."scheduleVersion", j.attempts, j."maxAttempts", j."runAt", j.payload
  `);
}

export async function recoverExpiredLeases(
  client: PrismaClient,
  now = new Date(),
) {
  await client.outboxJob.updateMany({
    where: {
      status: OutboxStatus.PROCESSING,
      leaseExpiresAt: { lt: now },
      attempts: { lt: 3 },
    },
    data: {
      status: OutboxStatus.PENDING,
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      lastError: "Lease worker kedaluwarsa; dijadwalkan ulang.",
    },
  });
  await client.outboxJob.updateMany({
    where: {
      status: OutboxStatus.PROCESSING,
      leaseExpiresAt: { lt: now },
      attempts: { gte: 3 },
    },
    data: {
      status: OutboxStatus.FAILED,
      completedAt: now,
      lastError: "Batas percobaan habis setelah pemulihan lease.",
    },
  });
}

type EmailResult = {
  status: EmailDeliveryStatus;
  messageId?: string;
  preview?: string;
  error?: string;
};

export function createSmtpTransport(): Transporter | null {
  if (process.env.EMAIL_ENABLED !== "true") return null;
  if (process.env.SMTP_DRY_RUN !== "false")
    return nodemailer.createTransport({ jsonTransport: true });
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
}

export async function deliverInternalEmail(
  input: {
    to: string;
    taskCode: string;
    reminderType: string;
    scheduledAt: Date;
    link: string;
    isTest?: boolean;
  },
  client: PrismaClient = db,
  transport: Transporter | null = createSmtpTransport(),
  now = new Date(),
): Promise<EmailResult> {
  const subject = input.isTest
    ? `[UJI] Pengingat Membuat Janji Akuisisi — ${input.taskCode}`
    : `[MABES LINK] ${input.reminderType} — ${input.taskCode}`;
  const timeWib = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short",
  }).format(input.scheduledAt);
  const confirmedAppointment = /pengingat janji|janji akuisisi/i.test(
    input.reminderType,
  );
  const reminderSentence = confirmedAppointment
    ? "Janji terkonfirmasi mendekati jadwal. Periksa agenda dan persiapkan layanan."
    : "Sudah waktunya membuat atau mengonfirmasi janji follow-up.";
  const text = input.isTest
    ? `Halo,\nTugas ${input.taskCode} sudah perlu ditindaklanjuti. Silakan hubungi calon nasabah untuk membuat atau mengonfirmasi jadwal janji terkait kebutuhan layanan yang sudah dicatat.\nWaktu tindak lanjut: ${timeWib} WIB.\nBuka detail pekerjaan: ${input.link}`
    : `Halo,\nTugas ${input.taskCode}: ${reminderSentence}\n${confirmedAppointment ? "Waktu janji" : "Waktu tindak lanjut"}: ${timeWib} WIB.\nBuka detail pekerjaan: ${input.link}`;
  if (process.env.EMAIL_ENABLED !== "true")
    return { status: EmailDeliveryStatus.DISABLED, preview: text };
  if (process.env.SMTP_DRY_RUN !== "false") {
    const testingTransport =
      transport ?? nodemailer.createTransport({ jsonTransport: true });
    const info = await testingTransport.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject,
      text,
    });
    return {
      status: EmailDeliveryStatus.DRY_RUN,
      messageId: info.messageId,
      preview:
        typeof info.message === "string"
          ? info.message
          : (info.message?.toString() ?? text),
    };
  }
  const dailyLimit = Number(process.env.EMAIL_DAILY_LIMIT ?? 250);
  const start = jakartaTimeToUtc(jakartaDateParts(now), "00:00");
  const sent = await client.emailDelivery.count({
    where: {
      status: EmailDeliveryStatus.SMTP_ACCEPTED,
      acceptedAt: { gte: start },
    },
  });
  if (sent >= dailyLimit)
    return {
      status: EmailDeliveryStatus.QUOTA_BLOCKED,
      error: "Batas pengiriman harian aplikasi tercapai.",
    };
  if (!transport)
    return {
      status: EmailDeliveryStatus.FAILED,
      error: "Transport SMTP belum lengkap.",
    };
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject,
      text,
    });
    return {
      status: EmailDeliveryStatus.SMTP_ACCEPTED,
      messageId: info.messageId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kesalahan SMTP tidak dikenal.";
    const ambiguous = /timeout|connection closed|socket/i.test(message);
    return {
      status: ambiguous
        ? EmailDeliveryStatus.UNKNOWN
        : EmailDeliveryStatus.FAILED,
      error: message,
    };
  }
}

export async function processJob(
  client: PrismaClient,
  job: ClaimedJob,
  now = new Date(),
  transport?: Transporter | null,
) {
  const recipient = await client.user.findUnique({
    where: { id: job.recipientId },
    select: {
      email: true,
      active: true,
      emailNotificationsEnabled: true,
      branchId: true,
    },
  });
  if (
    !recipient?.active ||
    (job.branchId && recipient.branchId !== job.branchId)
  ) {
    await client.outboxJob.update({
      where: { id: job.id },
      data: {
        status: OutboxStatus.CANCELLED,
        completedAt: now,
        lastError: "Penerima tidak aktif.",
      },
    });
    return;
  }
  const type: NotificationType = job.type as NotificationType;
  let code = "RINGKASAN";
  let link = "/follow-ups";
  let title = "Ringkasan pekerjaan terlambat";
  let message =
    "Periksa pekerjaan terlambat yang masih menjadi tanggung jawab Anda.";
  let isTest = false;
  let reminderExpiresAt: Date | null = null;
  let appointmentTime: Date | null = null;
  if (job.serviceCaseId) {
    const serviceCase = await client.serviceCase.findUnique({
      where: { id: job.serviceCaseId },
      include: {
        prospect: {
          select: {
            internalCode: true,
            latitude: true,
            longitude: true,
            locationVerifiedAt: true,
            locationUpdatedAt: true,
          },
        },
        participants: { select: { userId: true } },
      },
    });
    const validRecipient =
      serviceCase?.picId === job.recipientId ||
      serviceCase?.participants.some((item) => item.userId === job.recipientId);
    if (
      !serviceCase ||
      serviceCase.deletedAt !== null ||
      serviceCase.version !== job.scheduleVersion ||
      !validRecipient ||
      (serviceCase.sourceSystem === "MABES_LINK" && !serviceCase.acceptedAt) ||
      (serviceCase.appointmentStatus !== AppointmentStatus.NEEDS_SCHEDULING &&
        serviceCase.appointmentStatus !==
          AppointmentStatus.PENDING_CONFIRMATION &&
        serviceCase.appointmentStatus !== AppointmentStatus.CONFIRMED) ||
      ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(
        serviceCase.status,
      )
    ) {
      await client.outboxJob.update({
        where: { id: job.id },
        data: {
          status: OutboxStatus.CANCELLED,
          completedAt: now,
          lastError:
            "Versi tugas, PIC, janji, atau status sudah tidak berlaku.",
        },
      });
      return;
    }
    const payload = job.payload as Record<string, unknown> | null;
    if (
      serviceCase.appointmentStatus === "CONFIRMED" ||
      serviceCase.sourceSystem === "MABES_LINK"
    ) {
      const expiry =
        typeof payload?.expiresAt === "string"
          ? new Date(payload.expiresAt)
          : null;
      if (
        payload?.policy !== "APPOINTMENT_V2" ||
        !expiry ||
        !Number.isFinite(expiry.getTime()) ||
        now >= expiry ||
        !serviceCase.appointmentAt ||
        now >= appointmentAlarmDeadline(serviceCase.appointmentAt, job.type) ||
        (job.type === "APPOINTMENT_ACTION_DUE" &&
          (payload.minutesBefore !== 0 || now < serviceCase.appointmentAt)) ||
        payload.appointmentAt !== serviceCase.appointmentAt.toISOString()
      ) {
        await client.outboxJob.updateMany({
          where: { id: job.id, status: "PROCESSING" },
          data: {
            status: "CANCELLED",
            completedAt: now,
            lastError:
              "Pengingat legacy, kedaluwarsa, atau janji sudah lewat; tidak dikejar.",
          },
        });
        return;
      }
      reminderExpiresAt = expiry;
      const branch = await client.branch.findUnique({
        where: { id: serviceCase.branchId },
        select: { code: true },
      });
      const point = {
        ...serviceCase.prospect,
        latitude:
          serviceCase.prospect.latitude == null
            ? null
            : Number(serviceCase.prospect.latitude),
        longitude:
          serviceCase.prospect.longitude == null
            ? null
            : Number(serviceCase.prospect.longitude),
      };
      const currentDistance = appointmentDistancePolicy(
        point,
        branch?.code === "11539" ? verifiedAppointmentBranch() : null,
      );
      if (
        ![1, 5, 10].includes(Number(payload.snoozeMinutes)) &&
        !(
          job.type === "APPOINTMENT_ACTION_DUE" && payload.minutesBefore === 0
        ) &&
        payload.minutesBefore !== 1440 &&
        payload.minutesBefore !== currentDistance.minutesBefore
      ) {
        await client.$transaction(async (tx) => {
          const changed = await tx.serviceCase.updateMany({
            where: { id: serviceCase.id, version: serviceCase.version },
            data: { version: { increment: 1 } },
          });
          if (!changed.count) return;
          const latest = await tx.serviceCase.findUniqueOrThrow({
            where: { id: serviceCase.id },
          });
          await scheduleServiceCaseJobs(tx, latest, latest.branchId);
        });
        return; // Never send an incorrect/late distance reminder after coordinates change.
      }
    }
    isTest = serviceCase.isTest;
    appointmentTime = serviceCase.appointmentAt;
    if (
      isTest &&
      recipient.email.toLowerCase() !==
        process.env.TEST_NOTIFICATION_EMAIL?.toLowerCase()
    ) {
      await client.outboxJob.update({
        where: { id: job.id },
        data: {
          status: OutboxStatus.CANCELLED,
          completedAt: now,
          lastError: "Penerima data uji tidak sesuai allowlist.",
        },
      });
      return;
    }
    code = serviceCase.code;
    link = `/work/${serviceCase.id}`;
    title =
      serviceCase.appointmentStatus === AppointmentStatus.NEEDS_SCHEDULING
        ? "Perlu membuat janji"
        : serviceCase.appointmentStatus ===
            AppointmentStatus.PENDING_CONFIRMATION
          ? "Perlu mengonfirmasi janji"
          : job.type === OutboxJobType.APPOINTMENT_PRE_DUE
            ? "Janji akuisisi segera dimulai"
            : "Waktunya janji akuisisi";
    message =
      serviceCase.appointmentStatus === AppointmentStatus.CONFIRMED
        ? `${code} memiliki janji terkonfirmasi pada jadwal yang tercatat.`
        : `${code} memerlukan tindak lanjut oleh PIC.`;
    if (reminderExpiresAt) {
      title = payload?.snoozeMinutes
        ? `Pengingat janji — diingatkan kembali ${payload.snoozeMinutes} menit`
        : payload?.minutesBefore === 1440
          ? "Pengingat janji — 24 jam lagi"
          : payload?.minutesBefore === 0
            ? "Alarm janji — waktunya sekarang"
            : `Pengingat janji — ${payload?.minutesBefore === 15 ? "15 menit" : "1 jam"} lagi`;
      message = `${code} · Waktu janji ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(serviceCase.appointmentAt!)} WIB. ${payload?.snoozeMinutes ? "Pengingat ulang atas permintaan penerima." : payload?.minutesBefore === 0 ? "Waktu janji telah tiba; periksa agenda Anda." : payload?.distanceStatus === "VERIFIED" ? "Lokasi terverifikasi." : "Jarak belum dapat diverifikasi; jadwal cadangan 1 jam."}`;
    }
  } else if (job.followUpId) {
    const followUp = await client.followUp.findUnique({
      where: { id: job.followUpId },
      include: { prospect: { select: { internalCode: true } } },
    });
    if (
      !followUp ||
      followUp.status !== FollowUpStatus.PLANNED ||
      followUp.version !== job.scheduleVersion ||
      followUp.assignedToId !== job.recipientId
    ) {
      await client.outboxJob.update({
        where: { id: job.id },
        data: {
          status: OutboxStatus.CANCELLED,
          completedAt: now,
          lastError: "Versi jadwal/status/PIC sudah tidak berlaku.",
        },
      });
      return;
    }
    code = followUp.prospect.internalCode;
    link = `/follow-ups?task=${followUp.id}`;
    title =
      job.type === OutboxJobType.FOLLOW_UP_PRE_DUE
        ? "Pengingat sebelum follow-up jatuh tempo"
        : "Follow-up jatuh tempo";
    message = `${code} memerlukan tindakan pada jadwal yang tercatat.`;
  } else {
    const legacyOverdue = await client.followUp.count({
      where: {
        assignedToId: job.recipientId,
        status: FollowUpStatus.PLANNED,
        dueAt: { lt: now },
        prospect: { isTest: false },
      },
    });
    const serviceCaseOverdue = await client.serviceCase.count({
      where: {
        OR: [
          { picId: job.recipientId },
          { participants: { some: { userId: job.recipientId } } },
        ],
        isTest: false,
        deletedAt: null,
        dueAt: { lt: now },
        AND: [
          {
            OR: [
              { sourceSystem: null },
              { sourceSystem: { not: "MABES_LINK" } },
              {
                appointmentAt: { not: null },
                appointmentStatus: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            ],
          },
        ],
        appointmentStatus: {
          in: [
            AppointmentStatus.NEEDS_SCHEDULING,
            AppointmentStatus.PENDING_CONFIRMATION,
            AppointmentStatus.CONFIRMED,
          ],
        },
        status: {
          notIn: ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"],
        },
      },
    });
    const overdue = legacyOverdue + serviceCaseOverdue;
    if (overdue === 0) {
      await client.outboxJob.update({
        where: { id: job.id },
        data: {
          status: OutboxStatus.CANCELLED,
          completedAt: now,
          lastError: "Tidak ada follow-up terlambat.",
        },
      });
      return;
    }
    link = "/work?overdue=1";
    message = `${overdue} pekerjaan terlambat perlu ditinjau.`;
  }
  const notification = await client.$transaction(async (tx) => {
    // Serialize reminder publication with reschedule/cancel. Never hold this lock during SMTP.
    if (job.serviceCaseId) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${job.serviceCaseId} FOR UPDATE`,
      );
      const current = await tx.serviceCase.findUnique({
        where: { id: job.serviceCaseId },
      });
      const queued = await tx.outboxJob.findUnique({ where: { id: job.id } });
      if (
        !current ||
        current.version !== job.scheduleVersion ||
        current.deletedAt ||
        queued?.status !== "PROCESSING" ||
        ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(
          current.status,
        ) ||
        (reminderExpiresAt &&
          reminderExpiresAt <= new Date(Math.max(now.getTime(), Date.now())))
      ) {
        await tx.outboxJob.updateMany({
          where: { id: job.id, status: "PROCESSING" },
          data: {
            status: "CANCELLED",
            completedAt: now,
            lastError:
              "Jadwal berubah atau pengingat kedaluwarsa sebelum publikasi.",
          },
        });
        return null;
      }
    }
    return tx.notification.upsert({
      where: { dedupKey: `job:${job.id}` },
      create: {
        recipientId: job.recipientId,
        branchId: job.branchId,
        type,
        title,
        message,
        link,
        dedupKey: `job:${job.id}`,
        followUpId: job.followUpId,
        serviceCaseId: job.serviceCaseId,
        isTest,
        reminderExpiresAt,
      },
      update: {},
    });
  });
  if (!notification) return;
  // Recheck immediately before external delivery, outside the transaction.
  if (job.serviceCaseId) {
    const current = await client.serviceCase.findUnique({
      where: { id: job.serviceCaseId },
    });
    if (
      !current ||
      current.version !== job.scheduleVersion ||
      current.deletedAt ||
      ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(current.status) ||
      (reminderExpiresAt &&
        reminderExpiresAt <= new Date(Math.max(now.getTime(), Date.now())))
    ) {
      await client.outboxJob.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: { status: "CANCELLED", completedAt: now },
      });
      return;
    }
  }
  let email: EmailResult = { status: EmailDeliveryStatus.DISABLED };
  if (recipient.emailNotificationsEnabled) {
    await client.emailDelivery.upsert({
      where: { outboxJobId: job.id },
      create: {
        outboxJobId: job.id,
        notificationId: notification.id,
        recipientId: job.recipientId,
        status: EmailDeliveryStatus.QUEUED,
      },
      update: {
        notificationId: notification.id,
        status: EmailDeliveryStatus.QUEUED,
        error: null,
      },
    });
    email = await deliverInternalEmail(
      {
        to: recipient.email,
        taskCode: code,
        reminderType: title,
        scheduledAt: appointmentTime ?? job.runAt,
        link: `${process.env.APP_URL ?? "http://localhost:3000"}${link}`,
        isTest,
      },
      client,
      transport === undefined ? createSmtpTransport() : transport,
      now,
    );
  }
  const retryableEmailFailure =
    email.status === EmailDeliveryStatus.FAILED ||
    email.status === EmailDeliveryStatus.QUOTA_BLOCKED;
  const shouldRetry = retryableEmailFailure && job.attempts < job.maxAttempts;
  await client.$transaction(async (tx) => {
    await tx.emailDelivery.upsert({
      where: { outboxJobId: job.id },
      create: {
        outboxJobId: job.id,
        notificationId: notification.id,
        recipientId: job.recipientId,
        ...email,
        acceptedAt:
          email.status === EmailDeliveryStatus.SMTP_ACCEPTED ? now : null,
      },
      update: {
        ...email,
        acceptedAt:
          email.status === EmailDeliveryStatus.SMTP_ACCEPTED ? now : null,
      },
    });
    await tx.outboxJob.updateMany({
      where: { id: job.id, status: "PROCESSING" },
      data: {
        status:
          email.status === EmailDeliveryStatus.UNKNOWN
            ? OutboxStatus.UNKNOWN
            : shouldRetry
              ? OutboxStatus.PENDING
              : retryableEmailFailure
                ? OutboxStatus.FAILED
                : OutboxStatus.SUCCEEDED,
        runAt: shouldRetry
          ? new Date(now.getTime() + 2 ** job.attempts * 60_000)
          : undefined,
        completedAt: shouldRetry ? null : now,
        lastError: email.error ?? null,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
      },
    });
  });
}

export async function workerTick(
  client: PrismaClient = db,
  workerId = `worker-${process.pid}`,
  now = new Date(),
  transport?: Transporter | null,
) {
  const heartbeat = await client.workerHeartbeat.findUnique({
    where: { id: workerId },
  });
  await client.workerHeartbeat.upsert({
    where: { id: workerId },
    create: {
      id: workerId,
      processId: process.pid,
      hostname: hostname(),
      lastSeen: now,
      startedAt: now,
    },
    update: {
      processId: process.pid,
      hostname: hostname(),
      lastSeen: now,
      startedAt: heartbeat?.startedAt ?? now,
    },
  });
  await recoverExpiredLeases(client, now);
  await ensureDailyDigests(client, now);
  const jobs = await claimJobs(client, workerId, now);
  for (const job of jobs)
    await processJob(
      client,
      job,
      new Date(Math.max(now.getTime(), Date.now())),
      transport,
    );
  return jobs.length;
}

/** Worker boot migration of reminder policy; never changes appointment time/owner/accounts. */
export async function reconcileAppointmentJobs(client: PrismaClient = db) {
  let updated = 0;
  let cursor: string | undefined;
  for (;;) {
    const cases = await client.serviceCase.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"] },
        OR: [
          { sourceSystem: "MABES_LINK" },
          { appointmentStatus: "CONFIRMED" },
        ],
      },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const item of cases) {
      // Cancel pre-acceptance jobs left by older versions, including V2 jobs.
      if (item.sourceSystem === "MABES_LINK" && !item.acceptedAt) {
        await client.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${item.id} FOR UPDATE`,
          );
          const latest = await tx.serviceCase.findUniqueOrThrow({
            where: { id: item.id },
          });
          if (!latest.acceptedAt && latest.version === item.version)
            await scheduleServiceCaseJobs(tx, latest, latest.branchId);
        });
        continue;
      }
      const jobs = await client.outboxJob.findMany({
        where: { serviceCaseId: item.id, scheduleVersion: item.version },
        select: { dedupKey: true, status: true },
      });
      if (jobs.some((job) => job.dedupKey.includes(":v2:"))) {
        // Add only the new due-time slot. Preserve delivered pre-reminders and receipts.
        // Case lock + unique recipient/version key make concurrent restarts idempotent.
        await client.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${item.id} FOR UPDATE`,
          );
          const latest = await tx.serviceCase.findUniqueOrThrow({
            where: { id: item.id },
          });
          if (
            latest.version !== item.version ||
            latest.deletedAt ||
            latest.appointmentStatus !== "CONFIRMED" ||
            !latest.appointmentAt ||
            latest.appointmentAt <= new Date() ||
            (latest.sourceSystem === "MABES_LINK" && !latest.acceptedAt) ||
            ["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(
              latest.status,
            )
          )
            return;
          const participants = await tx.serviceCaseParticipant.findMany({
            where: { serviceCaseId: latest.id },
            select: { userId: true },
          });
          await tx.outboxJob.createMany({
            data: [
              ...new Set([latest.picId, ...participants.map((p) => p.userId)]),
            ].map((recipientId) => ({
              recipientId,
              branchId: latest.branchId,
              serviceCaseId: latest.id,
              scheduleVersion: latest.version,
              isTest: latest.isTest,
              testNamespace: latest.testNamespace,
              type: "APPOINTMENT_ACTION_DUE",
              dedupKey: `appointment:${latest.id}:v${latest.version}:recipient:${recipientId}:v2:0`,
              runAt: latest.appointmentAt!,
              payload: {
                policy: "APPOINTMENT_V2",
                minutesBefore: 0,
                appointmentAt: latest.appointmentAt!.toISOString(),
                expiresAt: new Date(
                  latest.appointmentAt!.getTime() + REMINDER_GRACE_MS,
                ).toISOString(),
                distanceStatus: "DUE_TIME",
              },
            })),
            skipDuplicates: true,
          });
        });
        continue;
      }
      if (
        !jobs.some((job) => ["PENDING", "PROCESSING"].includes(job.status)) &&
        !(
          item.appointmentStatus === "CONFIRMED" &&
          item.appointmentAt &&
          item.appointmentAt > new Date()
        )
      )
        continue;
      const changed = await client.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ServiceCase" WHERE id = ${item.id} FOR UPDATE`,
        );
        const latest = await tx.serviceCase.findUniqueOrThrow({
          where: { id: item.id },
        });
        if (latest.version !== item.version) return false;
        if (
          await tx.outboxJob.findFirst({
            where: {
              serviceCaseId: item.id,
              scheduleVersion: latest.version,
              dedupKey: { contains: ":v2:" },
            },
          })
        )
          return false;
        await scheduleServiceCaseJobs(tx, latest, latest.branchId);
        return true;
      });
      if (changed) updated++;
    }
    if (cases.length < 500) break;
    cursor = cases[cases.length - 1].id;
  }
  return updated;
}
