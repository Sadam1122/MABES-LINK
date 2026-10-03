import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { updateException } from "@/lib/services/handovers";
import { exceptionPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; exceptionId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, exceptionId } = await context.params;
    return jsonOk(
      await updateException(
        actor,
        id,
        exceptionId,
        exceptionPatchSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
