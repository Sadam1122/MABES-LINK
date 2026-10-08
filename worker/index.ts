import "../scripts/load-env";

import { db } from "../lib/db";
import { workerTick, reconcileAppointmentJobs } from "../lib/notifications";
import { validateWorkerEnvironment } from "../lib/env-validation";
import { cleanupExpiredQrisSessions } from "../lib/qris-cleanup";

validateWorkerEnvironment();

const interval = Math.max(
  5_000,
  Number(process.env.WORKER_POLL_INTERVAL_MS ?? 60_000),
);
const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
let stopping = false;
let activeTick: Promise<void> | null = null;
let lastQrisCleanup = 0;

async function tick() {
  try {
    const count = await workerTick(db, workerId);
    if (count) console.log(`[${workerId}] ${count} job diproses.`);
    if (Date.now() - lastQrisCleanup > 15 * 60_000) {
      lastQrisCleanup = Date.now();
      await cleanupExpiredQrisSessions();
    }
  } catch (error) {
    // Do not emit raw Prisma/SMTP errors containing request payloads or credentials.
    console.error(
      `[${workerId}] tick gagal (${error instanceof Error ? error.name : "UNKNOWN"}). Periksa status job internal.`,
    );
  }
}

async function main() {
  await reconcileAppointmentJobs(db);
  const run = () => {
    if (stopping || activeTick) return;
    activeTick = tick().finally(() => {
      activeTick = null;
    });
  };
  const timer = setInterval(run, interval);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      clearInterval(timer);
      await activeTick;
      await db.$disconnect();
      process.exit(0);
    });
  }
  run();
}

void main().catch(async (error) => {
  console.error(
    `[${workerId}] startup gagal (${error instanceof Error ? error.name : "UNKNOWN"}). Jalankan migration dan periksa konfigurasi worker.`,
  );
  await db.$disconnect();
  process.exitCode = 1;
});
