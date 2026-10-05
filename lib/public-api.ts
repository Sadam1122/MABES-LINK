import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { apiError } from "@/lib/api";
import { isAppError } from "@/lib/errors";

export function publicApiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return Response.json({ error: { code: "DUPLICATE", message: "Permintaan serupa sudah tercatat." } }, { status: 409 });
  if (isAppError(error) || error instanceof ZodError)
    return apiError(error);
  // Tidak mencetak payload/form, QR, query Prisma, token, atau data kontak.
  console.error("QRIS public request failed", error instanceof Error ? error.name : typeof error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Permintaan belum dapat diproses. Coba lagi nanti." } }, { status: 500 });
}
