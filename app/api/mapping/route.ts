import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createMappingLocation } from "@/lib/services/mapping";
import { listMappingProspects } from "@/lib/services/visits";
import {
  mappingLocationCreateSchema,
  paginationSchema,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createMappingLocation(
        actor,
        mappingLocationCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    return jsonOk(
      await listMappingProspects(actor, {
        ...paginationSchema.parse(raw),
        areaBlock: raw.areaBlock,
        businessSector: raw.businessSector,
        actionNeeded: raw.actionNeeded === "1",
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
