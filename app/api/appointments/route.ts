import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createAppointment } from "@/lib/services/service-cases";
import { appointmentCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createAppointment(
        actor,
        appointmentCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
