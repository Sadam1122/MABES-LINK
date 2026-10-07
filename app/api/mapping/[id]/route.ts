import { apiError, assertSameOrigin, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { updateMappingLocation } from "@/lib/services/mapping";
import { mappingLocationPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { id } = await params;
    return jsonOk(
      await updateMappingLocation(
        actor,
        id,
        mappingLocationPatchSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
