import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { getPilotConfig, updatePilotConfig } from "@/lib/services/admin";
import { pilotConfigSchema } from "@/lib/validation";

export async function GET() {
  try {
    return jsonOk(await getPilotConfig(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return jsonOk(
      await updatePilotConfig(
        await requireActor(),
        pilotConfigSchema.parse(await parseJson(request)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
