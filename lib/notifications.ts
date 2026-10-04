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
  if (
    serviceCase.appointmentStatus !== AppointmentStatus.NEEDS_SCHEDULING &&
    serviceCase.appointmentStatus !== AppointmentStatus.PENDING_CONFIRMATION &&
    serviceCase.appointmentStatus !== AppointmentStatus.CONFIRMED
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
  const reminderAt =
    serviceCase.appointmentStatus === AppointmentStatus.CONFIRMED &&
    serviceCase.appointmentAt
      ? serviceCase.appointmentAt
      : serviceCase.dueAt;
  const confirmedAppointment =
    serviceCase.appointmentStatus === AppointmentStatus.CONFIRMED;
  const preReminderAt = new Date(
    reminderAt.getTime() - minutes * 60_000,
  );
  await tx.outboxJob.createMany({
    data: [
      {
        type: OutboxJobType.APPOINTMENT_PRE_DUE,
        dedupKey: `${prefix}:pre`,
        recipientId: serviceCase.picId,
        branchId,
        serviceCaseId: serviceCase.id,
        scheduleVersion: serviceCase.version,
        runAt: confirmedAppointment
          ? preReminderAt
          : applyJakartaQuietHours(preReminderAt, quietStart, quietEnd),
        isTest: serviceCase.isTest,
        testNamespace: serviceCase.testNamespace,
      },
      {
        type: OutboxJobType.APPOINTMENT_ACTION_DUE,
        dedupKey: `${prefix}:due`,
        recipientId: serviceCase.picId,
        branchId,
        serviceCaseId: serviceCase.id,
        scheduleVersion: serviceCase.version,
        runAt: confirmedAppointment
          ? reminderAt
          : applyJakartaQuietHours(reminderAt, quietStart, quietEnd),
        isTest: serviceCase.isTest,
        testNamespace: serviceCase.testNamespace,
      },
    ],
    skipDuplicates: true,
  });
}

export async function cancelServiceCaseJobs(
  tx: Tx,
  serviceCaseId: string,
  reason: string,
) {
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
      j."scheduleVersion", j.attempts, j."maxAttempts", j."runAt"
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
  const confirmedAppointment = /janji akuisisi/i.test(input.reminderType);
  const reminderSentence = confirmedAppointment
    ? "Sudah waktunya menjalankan janji akuisisi yang telah dikonfirmasi."
    : "Sudah waktunya membuat atau mengonfirmasi janji follow-up.";
  const text = input.isTest
    ? `Halo,\nTugas ${input.taskCode} sudah perlu ditindaklanjuti. Silakan hubungi calon nasabah untuk membuat atau mengonfirmasi jadwal janji terkait kebutuhan layanan yang sudah dicatat.\nWaktu tindak lanjut: ${timeWib} WIB.\nBuka detail pekerjaan: ${input.link}`
    : `Halo,\nTugas ${input.taskCode}: ${reminderSentence}\nWaktu tindak lanjut: ${timeWib} WIB.\nBuka detail pekerjaan: ${input.link}`;
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
    select: { email: true, active: true, emailNotificationsEnabled: true },
  });
  if (!recipient?.active) {
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
  if (job.serviceCaseId) {
    const serviceCase = await client.serviceCase.findUnique({
      where: { id: job.serviceCaseId },
      include: { prospect: { select: { internalCode: true } } },
    });
    if (
      !serviceCase ||
      serviceCase.version !== job.scheduleVersion ||
      serviceCase.picId !== job.recipientId ||
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
    isTest = serviceCase.isTest;
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
        : serviceCase.appointmentStatus === AppointmentStatus.PENDING_CONFIRMATION
          ? "Perlu mengonfirmasi janji"
          : job.type === OutboxJobType.APPOINTMENT_PRE_DUE
            ? "Janji akuisisi segera dimulai"
            : "Waktunya janji akuisisi";
    message =
      serviceCase.appointmentStatus === AppointmentStatus.CONFIRMED
        ? `${code} memiliki janji terkonfirmasi pada jadwal yang tercatat.`
        : `${code} memerlukan tindak lanjut oleh PIC.`;
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
    const [legacyOverdue, serviceCaseOverdue] = await client.$transaction([
      client.followUp.count({
        where: {
          assignedToId: job.recipientId,
          status: FollowUpStatus.PLANNED,
          dueAt: { lt: now },
          prospect: { isTest: false },
        },
      }),
      client.serviceCase.count({
        where: {
          picId: job.recipientId,
          isTest: false,
          dueAt: { lt: now },
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
      }),
    ]);
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
  const notification = await client.notification.upsert({
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
    },
    update: {},
  });
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
        scheduledAt: job.runAt,
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
  await client.$transaction([
    client.emailDelivery.upsert({
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
    }),
    client.outboxJob.update({
      where: { id: job.id },
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
    }),
  ]);
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
  for (const job of jobs) await processJob(client, job, now, transport);
  return jobs.length;
}
