import "dotenv/config";

import { db } from "../lib/db";
import { workerTick } from "../lib/notifications";

const interval = Math.max(
  5_000,
  Number(process.env.WORKER_POLL_INTERVAL_MS ?? 60_000),
);
const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
let stopping = false;

async function tick() {
  try {
    const count = await workerTick(db, workerId);
    if (count) console.log(`[${workerId}] ${count} job diproses.`);
  } catch (error) {
    console.error(`[${workerId}] tick gagal`, error);
  }
}

async function main() {
  await tick();
  const timer = setInterval(() => void tick(), interval);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      clearInterval(timer);
      await db.$disconnect();
      process.exit(0);
    });
  }
}

void main();
