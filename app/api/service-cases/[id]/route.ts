import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import {
  archiveServiceCase,
  getServiceCase,
  updateServiceCase,
} from "@/lib/services/service-cases";
import { serviceCasePatchSchema } from "@/lib/validation";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    return jsonOk(await getServiceCase(actor, id));
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
    return jsonOk(
      await updateServiceCase(
        actor,
        id,
        serviceCasePatchSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
    );
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
    const payload = z
      .object({ version: z.number().int().positive() })
      .parse(await parseJson(request));
    return jsonOk(
      await archiveServiceCase(
        actor,
        id,
        payload.version,
        request.headers.get("x-request-id"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
