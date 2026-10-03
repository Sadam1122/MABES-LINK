import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import {
  getNotificationConfig,
  updateNotificationConfig,
} from "@/lib/services/admin";
import { notificationConfigSchema } from "@/lib/validation";

export async function GET() {
  try {
    return jsonOk(await getNotificationConfig(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    return jsonOk(
      await updateNotificationConfig(
        await requireActor(),
        notificationConfigSchema.parse(await parseJson(request)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
