import { HandoverStatus } from "@prisma/client";

import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createHandover, listHandovers } from "@/lib/services/handovers";
import { handoverCreateSchema, paginationSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const base = paginationSchema.parse(raw);
    const status = Object.values(HandoverStatus).includes(
      raw.status as HandoverStatus,
    )
      ? (raw.status as HandoverStatus)
      : undefined;
    return jsonOk(await listHandovers(actor, { ...base, status }));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createHandover(
        actor,
        handoverCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
