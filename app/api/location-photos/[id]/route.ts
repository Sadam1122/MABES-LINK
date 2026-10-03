import { apiError, jsonOk } from "@/lib/api";
import { requireActor } from "@/lib/session";
import {
  deleteLocationPhoto,
  getLocationPhoto,
  replaceLocationPhoto,
} from "@/lib/services/location-photos";
import { AppError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const { photo, data } = await getLocationPhoto(actor, id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${photo.id}.webp"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    await deleteLocationPhoto(actor, id, request.headers.get("x-request-id"));
    return jsonOk({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("File gambar wajib dipilih.", 422, "FILE_REQUIRED");
    return jsonOk(
      await replaceLocationPhoto(
        actor,
        id,
        file,
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
