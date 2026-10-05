import "./load-env";

import { db } from "../lib/db";

const id = process.argv[2];
if (!id) throw new Error("Gunakan: tsx scripts/diagnose-appointment.ts <id>");

const wib = (value: Date | null) => {
  if (!value) return null;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(value);
  return /\bWIB\b/i.test(formatted) ? formatted : `${formatted} WIB`;
};

async function main() {
  const item = await db.serviceCase.findUnique({
    where: { id },
    select: {
      code: true,
      status: true,
      appointmentStatus: true,
      appointmentAt: true,
      dueAt: true,
      version: true,
      isTest: true,
      pic: {
        select: {
          role: true,
          active: true,
          emailNotificationsEnabled: true,
        },
      },
      outboxJobs: {
        select: {
          type: true,
          status: true,
          scheduleVersion: true,
          runAt: true,
          attempts: true,
          lastError: true,
        },
        orderBy: { runAt: "asc" },
      },
      notifications: {
        select: { type: true, createdAt: true, readAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const heartbeat = await db.workerHeartbeat.findFirst({
    orderBy: { lastSeen: "desc" },
    select: { lastSeen: true, startedAt: true },
  });
  if (!item) {
    console.log(JSON.stringify({ found: false, id }, null, 2));
    return;
  }
  console.log(
    JSON.stringify(
      {
        found: true,
        code: item.code,
        status: item.status,
        appointmentStatus: item.appointmentStatus,
        appointmentAtWib: wib(item.appointmentAt),
        dueAtWib: wib(item.dueAt),
        version: item.version,
        isTest: item.isTest,
        pic: item.pic,
        jobs: item.outboxJobs.map((job) => ({
          ...job,
          runAt: wib(job.runAt),
        })),
        notifications: item.notifications.map((notice) => ({
          ...notice,
          createdAt: wib(notice.createdAt),
          readAt: wib(notice.readAt),
        })),
        latestWorkerHeartbeat: heartbeat
          ? {
              lastSeen: wib(heartbeat.lastSeen),
              startedAt: wib(heartbeat.startedAt),
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().finally(async () => db.$disconnect());
