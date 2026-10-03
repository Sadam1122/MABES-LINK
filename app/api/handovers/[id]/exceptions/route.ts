import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createException } from "@/lib/services/handovers";
import { exceptionCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return jsonOk(
      await createException(
        actor,
        id,
        exceptionCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
