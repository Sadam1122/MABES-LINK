import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { updateFollowUp } from "@/lib/services/follow-ups";
import { followUpPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(
      await updateFollowUp(
        actor,
        id,
        followUpPatchSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
