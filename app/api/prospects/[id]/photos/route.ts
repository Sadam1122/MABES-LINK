import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { addLocationPhoto } from "@/lib/services/location-photos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json(
        { error: { code: "FILE_REQUIRED", message: "Pilih gambar." } },
        { status: 422 },
      );
    return jsonOk(
      await addLocationPhoto(
        actor,
        id,
        file,
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
