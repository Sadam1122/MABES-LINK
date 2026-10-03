import "server-only";

import { Role } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
};

function toActor(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
): Actor | null {
  if (!session?.user || !session.user.active) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
    branchId: session.user.branchId ?? null,
  };
}

export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return toActor(session);
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor)
    throw new AppError(
      "Sesi tidak valid atau akun nonaktif.",
      401,
      "UNAUTHENTICATED",
    );
  return actor;
}

export async function requirePageActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}
