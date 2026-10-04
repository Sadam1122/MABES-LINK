import "./load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { EmailDeliveryStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  createSmtpTransport,
  deliverInternalEmail,
} from "../lib/notifications";
import { requireEnvironment } from "../lib/env-validation";

const allowedTarget = "sadamalrasyid1@gmail.com";
const target =
  process.env.TEST_NOTIFICATION_EMAIL?.trim().toLowerCase() || allowedTarget;
if (target !== allowedTarget)
  throw new Error("Penerima smoke test tidak diizinkan.");
if (
  process.env.EMAIL_ENABLED !== "true" ||
  process.env.SMTP_DRY_RUN !== "false"
)
  throw new Error(
    "Set EMAIL_ENABLED=true dan SMTP_DRY_RUN=false secara eksplisit.",
  );
requireEnvironment([
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "APP_URL",
] as const);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const recipient = await db.user.findUnique({
    where: { email: target },
    select: {
      active: true,
      isTest: true,
      emailNotificationsEnabled: true,
    },
  });
  if (
    !recipient ||
    !recipient.active ||
    recipient.isTest ||
    !recipient.emailNotificationsEnabled
  )
    throw new Error(
      "Penerima smoke test harus akun internal operasional aktif dan mengizinkan email.",
    );
  const transport = createSmtpTransport();
  if (!transport) throw new Error("Transport SMTP tidak tersedia.");
  await transport.verify();
  const now = new Date();
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const statusKey = `smtp-smoke:${day}`;
  try {
    await db.appConfig.create({
      data: {
        key: statusKey,
        value: { status: "QUEUED", target, attemptedAt: now.toISOString() },
        description:
          "Status smoke test SMTP; maksimum satu percobaan per hari WIB",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new Error(
        `Smoke test ${day} sudah pernah dicoba; pengiriman ulang otomatis ditolak.`,
      );
    throw error;
  }
  const result = await deliverInternalEmail(
    {
      to: target,
      taskCode: `SMTP-${now.toISOString().slice(0, 10).replaceAll("-", "")}`,
      reminderType: "Perlu membuat janji",
      scheduledAt: now,
      link: new URL("/work", process.env.APP_URL).toString(),
      isTest: true,
    },
    db,
    transport,
    now,
  );
  await db.appConfig.update({
    where: { key: statusKey },
    data: {
      value: {
        status: result.status,
        target,
        messageId: result.messageId ?? null,
        error: result.error ?? null,
        attemptedAt: now.toISOString(),
      },
    },
  });
  console.log(
    `Status SMTP: ${result.status}; messageId: ${result.messageId ?? "tidak ada"}`,
  );
  if (result.status !== EmailDeliveryStatus.SMTP_ACCEPTED) {
    throw new Error(
      `SMTP belum menerima pesan: ${result.status}${result.error ? ` (${result.error})` : ""}.`,
    );
  }
  console.log(
    `SMTP accepted untuk ${target}; ini bukan bukti pesan sudah masuk inbox.`,
  );
}

main().finally(async () => db.$disconnect());
