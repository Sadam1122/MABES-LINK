import "./load-env";
import { db } from "../lib/db";
import { verifiedAppointmentBranch } from "../lib/appointment-reminders";

// Read-only diagnostics: no task/customer identifiers, email addresses or secrets.
async function main() {
  const latest = await db.workerHeartbeat.findFirst({
    orderBy: { lastSeen: "desc" },
    select: { lastSeen: true },
  });
  const now = Date.now();
  console.log(
    JSON.stringify(
      {
        databasePurpose: process.env.DATABASE_PURPOSE ?? "operational",
        mappingCount: await db.prospect.count({
          where: { mappingImportedAt: { not: null }, isTest: false },
        }),
        operationalUserCount: await db.user.count({ where: { isTest: false } }),
        confirmedAppointments: await db.serviceCase.count({
          where: {
            isTest: false,
            deletedAt: null,
            appointmentStatus: "CONFIRMED",
          },
        }),
        confirmedWithoutTime: await db.serviceCase.count({
          where: {
            isTest: false,
            deletedAt: null,
            appointmentStatus: "CONFIRMED",
            appointmentAt: null,
          },
        }),
        pendingJobs: await db.outboxJob.count({
          where: { isTest: false, status: "PENDING" },
        }),
        lastWorkerSeen: latest?.lastSeen ?? null,
        workerSeenWithin180Seconds: Boolean(
          latest && now - latest.lastSeen.getTime() < 180_000,
        ),
        emailEnabled: process.env.EMAIL_ENABLED === "true",
        smtpDryRun: process.env.SMTP_DRY_RUN !== "false",
        smtpConfigurationComplete: [
          "SMTP_HOST",
          "SMTP_PORT",
          "SMTP_USER",
          "SMTP_PASS",
          "SMTP_FROM",
          "APP_URL",
        ].every((key) => Boolean(process.env[key]?.trim())),
        branchCoordinateVerified: Boolean(verifiedAppointmentBranch()),
        browserAudioState:
          "Tidak dapat diinspeksi dari server; periksa Pengaturan Notifikasi pada perangkat pengguna.",
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(
      `Diagnosis gagal (${error instanceof Error ? error.name : "UNKNOWN"}).`,
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
