import { apiError, assertSameOrigin, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { deleteHomeBanner } from "@/lib/services/home-banners";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await deleteHomeBanner(actor, (await params).id, request.headers.get("x-request-id"));
    return jsonOk({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
