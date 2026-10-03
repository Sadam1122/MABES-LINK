import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { getDashboard } from "@/lib/services/dashboard";

export async function GET() {
  try {
    return jsonOk(await getDashboard(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
