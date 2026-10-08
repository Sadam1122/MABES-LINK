import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { notificationCursorSchema } from "@/lib/notification-cursor";
import {
  listNotifications,
  markAllNotificationsRead,
} from "@/lib/services/notifications";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const cursor = params.get("cursor");
    return jsonOk(
      await listNotifications(actor, cursor ? notificationCursorSchema.parse(cursor) : undefined),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH() {
  try {
    return jsonOk(await markAllNotificationsRead(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
