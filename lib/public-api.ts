import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { apiError } from "@/lib/api";
import { isAppError } from "@/lib/errors";

export function publicApiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return Response.json({ error: { code: "DUPLICATE", message: "Permintaan serupa sudah tercatat." } }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    console.error("QRIS public database schema unavailable", error.code);
    return Response.json({ error: { code: "SERVICE_NOT_READY", message: "Layanan desain sementara belum siap. Hubungi petugas atau coba lagi setelah aplikasi diperbarui." } }, { status: 503 });
  }
  if (error instanceof Prisma.PrismaClientValidationError && /Unknown argument `(publicRequestId|selectedTemplate)`/.test(error.message)) {
    console.error("QRIS public Prisma Client is stale; restart the web process after prisma generate");
    return Response.json({ error: { code: "CLIENT_STALE", message: "Server web belum memuat skema QRIS terbaru. Mulai ulang proses web, lalu coba lagi." } }, { status: 503 });
  }
  if (isAppError(error) || error instanceof ZodError)
    return apiError(error);
  // Tidak mencetak payload/form, QR, query Prisma, token, atau data kontak.
  console.error("QRIS public request failed", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : typeof error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Permintaan belum dapat diproses. Coba lagi nanti." } }, { status: 500 });
}
