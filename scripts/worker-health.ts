import "./load-env";
import { db } from "../lib/db";

async function main() {
  const maxAge = Math.max(
    180_000,
    Number(process.env.WORKER_POLL_INTERVAL_MS ?? 60_000) * 3,
  );
  const latest = await db.workerHeartbeat.findFirst({
    orderBy: { lastSeen: "desc" },
  });
  await db.$disconnect();
  if (!latest || Date.now() - latest.lastSeen.getTime() > maxAge) {
    console.error("Worker heartbeat tidak sehat.");
    process.exit(1);
  }
  console.log(`Worker sehat; heartbeat ${latest.lastSeen.toISOString()}.`);
}
void main();
