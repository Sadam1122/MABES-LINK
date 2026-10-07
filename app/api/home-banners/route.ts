import { apiError, assertSameOrigin, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { listHomeBanners, uploadHomeBanner } from "@/lib/services/home-banners";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();
    const banners = await listHomeBanners();
    return jsonOk(banners.map((banner) => ({
      id: banner.id, title: banner.title, description: banner.description,
      width: banner.width, height: banner.height,
      canDelete: banner.createdById === actor.id || actor.role === "ADMIN" || actor.role === "SUPERVISOR",
    })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: { code: "FILE_REQUIRED", message: "Pilih gambar banner." } }, { status: 422 });
    return jsonOk(await uploadHomeBanner(actor, {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      file,
    }, request.headers.get("x-request-id")), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
