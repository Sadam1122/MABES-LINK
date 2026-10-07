import { apiError, assertSameOrigin, jsonOk, parseJson } from "@/lib/api";
import { mappingDiscoverySchema } from "@/lib/mapping-discovery";
import { requireActor } from "@/lib/session";
import { getMappingDiscovery, saveMappingDiscovery } from "@/lib/services/mapping-discovery";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try { return jsonOk(await getMappingDiscovery(await requireActor(), (await params).id)); }
  catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try { assertSameOrigin(request); return jsonOk(await saveMappingDiscovery(await requireActor(), (await params).id,
    mappingDiscoverySchema.parse(await parseJson(request)), request.headers.get("x-request-id"))); }
  catch (error) { return apiError(error); }
}
