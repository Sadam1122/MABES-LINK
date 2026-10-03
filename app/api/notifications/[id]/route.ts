import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { markNotificationRead } from "@/lib/services/notifications";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    await markNotificationRead(actor, BigInt(id));
    return jsonOk({ read: true });
  } catch (error) {
    return apiError(error);
  }
}
