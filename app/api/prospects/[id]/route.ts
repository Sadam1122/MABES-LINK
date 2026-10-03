import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { getProspect, updateProspect } from "@/lib/services/prospects";
import { prospectPatchSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(await getProspect(actor, id));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(
      await updateProspect(
        actor,
        id,
        prospectPatchSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
