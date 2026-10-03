import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createVisit } from "@/lib/services/visits";
import { visitCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createVisit(
        actor,
        visitCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
