import { z } from "zod";
import { jsonOk, parseJson } from "@/lib/api";
import { publicApiError } from "@/lib/public-api";
import { checkPublicRateLimit, deleteQrisSession } from "@/lib/qris-custom";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await checkPublicRateLimit(request, "delete", 20);
    const input = z
      .object({
        sessionId: z.string().min(1).max(80),
        token: z.string().min(20).max(100),
      })
      .parse(await parseJson(request));
    await deleteQrisSession(input.sessionId, input.token);
    return jsonOk({ deleted: true });
  } catch (error) {
    return publicApiError(error);
  }
}
