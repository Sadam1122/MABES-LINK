import { requireActorFromHeaders } from "@/lib/session";
import { apiError } from "@/lib/api";
import { notificationCursorSchema } from "@/lib/notification-cursor";
import { listNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireActorFromHeaders(request.headers);
    const url = new URL(request.url);
    let cursor = notificationCursorSchema.parse(
      request.headers.get("last-event-id") ||
        url.searchParams.get("cursor") ||
        "0",
    );
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let polling = false;
    const stream = new ReadableStream({
      start(controller) {
        const send = async () => {
          if (closed || polling) return;
          polling = true;
          try {
            // Revalidate persistent session/account access on every poll, not only connect.
            const currentActor = await requireActorFromHeaders(request.headers);
            if (
              currentActor.id !== actor.id ||
              currentActor.branchId !== actor.branchId ||
              currentActor.role !== actor.role
            )
              throw new Error("SESSION_SCOPE_CHANGED");
            if (closed) return;
            const items = await listNotifications(currentActor, cursor, 100);
            if (closed) return;
            for (const item of items) {
              cursor = BigInt(item.id);
              controller.enqueue(
                encoder.encode(
                  `id: ${item.id}\nevent: notification\ndata: ${JSON.stringify(item)}\n\n`,
                ),
              );
            }
            controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
          } catch {
            closed = true;
            if (timer) clearInterval(timer);
            try {
              controller.close();
            } catch {}
          } finally {
            polling = false;
          }
        };
        void send();
        timer = setInterval(
          () => void send(),
          Math.max(1_000, Number(process.env.SSE_POLL_INTERVAL_MS ?? 2_000)),
        );
        request.signal.addEventListener("abort", () => {
          closed = true;
          if (timer) clearInterval(timer);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        closed = true;
        if (timer) clearInterval(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
