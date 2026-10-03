import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createUsageVerification } from "@/lib/services/usage";
import { usageCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createUsageVerification(
        actor,
        usageCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
