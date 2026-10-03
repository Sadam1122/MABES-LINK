import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { updateUser } from "@/lib/services/admin";
import { userPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return jsonOk(
      await updateUser(
        await requireActor(),
        id,
        userPatchSchema.parse(await parseJson(request)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
