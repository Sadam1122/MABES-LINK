import { apiError, assertSameOrigin, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { notificationCursorSchema } from "@/lib/notification-cursor";
import {
  actOnAppointmentAlarm,
  alarmActionSchema,
  getAppointmentAlarm,
} from "@/lib/services/appointment-alarm";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(
      await getAppointmentAlarm(actor, notificationCursorSchema.parse(id)),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(
      await actOnAppointmentAlarm(
        actor,
        notificationCursorSchema.parse(id),
        alarmActionSchema.parse(await parseJson(request)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
