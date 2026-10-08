import { z } from "zod";
import { requireActor } from "@/lib/session";
import { apiError, jsonOk, parseJson } from "@/lib/api";
import { notificationCursorSchema } from "@/lib/notification-cursor";
import { claimNotificationPresentation } from "@/lib/services/notifications";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const { channel } = z.object({ channel: z.enum(["AUDIO", "POPUP"]) }).parse(await parseJson(request));
    return jsonOk(await claimNotificationPresentation(actor, notificationCursorSchema.parse(id), channel));
  } catch (error) { return apiError(error); }
}
