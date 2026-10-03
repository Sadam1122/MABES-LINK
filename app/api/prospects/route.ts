import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createProspect, listProspects } from "@/lib/services/prospects";
import { paginationSchema, prospectCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return jsonOk(await listProspects(actor, paginationSchema.parse(params)));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = prospectCreateSchema.parse(await parseJson(request));
    return jsonOk(
      await createProspect(actor, input, request.headers.get("x-request-id")),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
