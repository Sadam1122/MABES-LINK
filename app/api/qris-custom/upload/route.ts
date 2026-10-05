import { jsonOk } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { publicApiError } from "@/lib/public-api";
import { checkPublicRateLimit, createQrisSession } from "@/lib/qris-custom";
import { publicQrisContactSchema } from "@/lib/qris-design";
import { submitPublicQrisContact } from "@/lib/services/public-qris";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await checkPublicRateLimit(request, "upload", 12);
    const declaredBytes = Number(request.headers.get("content-length") || 0);
    if (declaredBytes > 9 * 1024 * 1024)
      throw new AppError(
        "Ukuran permintaan melebihi batas.",
        413,
        "REQUEST_TOO_LARGE",
      );
    const form = await request.formData();
    const intakeRaw = form.get("intake");
    if (typeof intakeRaw !== "string" || intakeRaw.length > 4000)
      throw new AppError(
        "Informasi usaha dan persetujuan wajib dilengkapi.",
        422,
        "INTAKE_REQUIRED",
      );
    let intakeValue: unknown;
    try {
      intakeValue = JSON.parse(intakeRaw);
    } catch {
      throw new AppError("Informasi usaha tidak valid.", 422, "INVALID_INTAKE");
    }
    const intake = publicQrisContactSchema.parse({
      ...(intakeValue as object),
      sessionId: "pending",
      token: "x".repeat(32),
    });
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("Pilih file QRIS resmi.", 422, "FILE_REQUIRED");
    if (file.size > 8 * 1024 * 1024)
      throw new AppError("Maksimum ukuran file 8 MB.", 422, "FILE_TOO_LARGE");
    const result = await createQrisSession(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    let contactSaved = false;
    let contactError = false;
    if (intake.contactConsent) {
      try {
        await submitPublicQrisContact({
          ...intake,
          sessionId: result.id,
          token: result.token,
        });
        contactSaved = true;
      } catch {
        contactError = true;
      }
    }
    return jsonOk(
      { ...result, contactSaved, contactError },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return publicApiError(error);
  }
}
