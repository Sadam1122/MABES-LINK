import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import { createUser, listUsers } from "@/lib/services/admin";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    return jsonOk(await listUsers(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    return jsonOk(
      await createUser(
        await requireActor(),
        userCreateSchema.parse(await parseJson(request)),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
