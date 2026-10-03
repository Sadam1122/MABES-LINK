import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { EmailDeliveryStatus, PrismaClient } from "@prisma/client";
import {
  createSmtpTransport,
  deliverInternalEmail,
} from "../lib/notifications";

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
for (const key of [
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "APP_URL",
] as const)
  if (!process.env[key]) throw new Error(`${key} wajib tersedia.`);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const transport = createSmtpTransport();
  if (!transport) throw new Error("Transport SMTP tidak tersedia.");
  await transport.verify();
  const now = new Date();
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
