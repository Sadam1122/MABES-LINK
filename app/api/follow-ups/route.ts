import { FollowUpStatus } from "@prisma/client";

import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createFollowUp, listFollowUps } from "@/lib/services/follow-ups";
import { followUpCreateSchema, paginationSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const base = paginationSchema.parse(raw);
    const status = Object.values(FollowUpStatus).includes(
      raw.status as FollowUpStatus,
    )
      ? (raw.status as FollowUpStatus)
      : undefined;
    const due = ["overdue", "today", "upcoming"].includes(raw.due)
      ? (raw.due as "overdue" | "today" | "upcoming")
      : undefined;
    return jsonOk(
      await listFollowUps(actor, {
        ...base,
        status,
        due,
        assignedToId: raw.assignedToId,
        held: raw.held === "1",
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createFollowUp(
        actor,
        followUpCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
