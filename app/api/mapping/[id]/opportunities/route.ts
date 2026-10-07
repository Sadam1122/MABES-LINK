import { apiError, assertSameOrigin, jsonOk, parseJson } from "@/lib/api";
import { mappingOpportunitySchema } from "@/lib/mapping-discovery";
import { requireActor } from "@/lib/session";
import { saveMappingOpportunity } from "@/lib/services/mapping-discovery";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); return jsonOk(await saveMappingOpportunity(await requireActor(), (await params).id,
    mappingOpportunitySchema.parse(await parseJson(request)), request.headers.get("x-request-id")), { status: 201 }); }
  catch (error) { return apiError(error); }
}
