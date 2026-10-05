import { jsonOk, parseJson } from "@/lib/api";
import { publicApiError } from "@/lib/public-api";
import { checkPublicRateLimit } from "@/lib/qris-custom";
import { publicQrisContactSchema } from "@/lib/qris-design";
import { submitPublicQrisContact } from "@/lib/services/public-qris";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await checkPublicRateLimit(request, "contact", 10);
    const input = publicQrisContactSchema.parse(await parseJson(request));
    return jsonOk(await submitPublicQrisContact(input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return publicApiError(error);
  }
}
