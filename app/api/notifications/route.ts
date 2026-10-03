import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { listNotifications } from "@/lib/services/notifications";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const cursor = params.get("cursor");
    return jsonOk(
      await listNotifications(actor, cursor ? BigInt(cursor) : undefined),
    );
  } catch (error) {
    return apiError(error);
  }
}
