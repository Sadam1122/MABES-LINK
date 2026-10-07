import { z } from "zod";
import { parseJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { publicApiError } from "@/lib/public-api";
import { checkPublicRateLimit, loadQrisSession } from "@/lib/qris-custom";
import { qrisDesignSchema } from "@/lib/qris-design";
import { qrisOutput, renderQrisDesign } from "@/lib/qris-render";
import { db } from "@/lib/db";
import { isSuppliedQrisTemplate } from "@/lib/qris-design";

export const runtime = "nodejs";

const schema = z.object({
  sessionId: z.string().min(1).max(80),
  token: z.string().min(20).max(100),
  design: qrisDesignSchema,
  format: z.enum(["png", "jpg", "pdf"]),
  download: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await checkPublicRateLimit(request, "render", 180);
    if (Number(request.headers.get("content-length") || 0) > 1_600_000)
      throw new AppError(
        "Permintaan desain terlalu besar.",
        413,
        "REQUEST_TOO_LARGE",
      );
    const input = schema.parse(await parseJson(request));
    const { session, data } = await loadQrisSession(
      input.sessionId,
      input.token,
    );
    const result = await renderQrisDesign(data, input.design, session.qrDigest);
    if (session.publicRequestId && isSuppliedQrisTemplate(result.design.template)) {
      await db.qrisDesignSession.update({
        where: { id: session.id },
        data: { selectedTemplate: result.design.template },
      });
      await db.prospect.updateMany({
        where: { publicQrisRequestId: session.publicRequestId, publicContactConsentAt: { not: null }, isTest: false },
        data: { publicQrisTemplate: result.design.template, publicQrisDesignedAt: new Date() },
      });
    }
    const output = await qrisOutput(
      result.png,
      input.format,
      input.design.size,
    );
    return new Response(new Uint8Array(output.data), {
      headers: {
        "Content-Type": output.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return publicApiError(error);
  }
}
