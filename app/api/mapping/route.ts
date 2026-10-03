import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { listMappingProspects } from "@/lib/services/visits";
import { paginationSchema } from "@/lib/validation";

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
