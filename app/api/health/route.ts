import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const worker = await db.workerHeartbeat.findFirst({
      orderBy: { lastSeen: "desc" },
      select: { lastSeen: true },
    });
    const workerHealthy =
      !!worker &&
      Date.now() - worker.lastSeen.getTime() <
        Math.max(
          180_000,
          Number(process.env.WORKER_POLL_INTERVAL_MS ?? 60_000) * 3,
        );
    return Response.json(
      {
        status: "ok",
        database: "ok",
        worker: workerHealthy ? "ok" : "stale-or-not-started",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
